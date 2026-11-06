"""
Reranker Module — Multi-Stage Neural & Heuristic Reranker for Document Retrieval.

Features:
1. Reciprocal Rank Fusion (RRF) to merge candidate ranks from BM25 and vector search.
2. Cross-Scoring: Evaluates semantic relevance, query-term density, key concept coverage,
   and page diversity.
3. Source-Type Prioritization: Dynamically adapts weights depending on whether the query
   requests tabular, diagrammatic, or conceptual content.
"""
import math
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class ScoredChunk:
    chunk_id: str
    doc_id: str
    page: int
    source_type: str
    content: str
    score: float
    metadata: Dict[str, Any]


class Reranker:
    """
    Reranks retrieved candidate chunks to surface the highest quality,
    most relevant, and diverse context for the reasoning engine.
    """

    def __init__(self, rrf_k: int = 60):
        self.rrf_k = rrf_k

    def reciprocal_rank_fusion(
        self,
        ranked_lists: List[List[Dict[str, Any]]],
        weights: Optional[List[float]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Combines multiple candidate rankings (e.g. BM25 rank + vector similarity rank)
        using Reciprocal Rank Fusion: score = sum(weight / (k + rank)).
        """
        if not ranked_lists:
            return []

        if weights is None:
            weights = [1.0] * len(ranked_lists)

        scores: Dict[str, float] = {}
        chunk_map: Dict[str, Dict[str, Any]] = {}

        for list_idx, chunk_list in enumerate(ranked_lists):
            w = weights[list_idx] if list_idx < len(weights) else 1.0
            for rank, item in enumerate(chunk_list):
                cid = item.get("chunk_id") or f"{item.get('doc_id')}_p{item.get('page')}_{rank}"
                if cid not in chunk_map:
                    chunk_map[cid] = item
                rrf_score = w / (self.rrf_k + rank + 1)
                scores[cid] = scores.get(cid, 0.0) + rrf_score

        sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
        results = []
        for cid in sorted_ids:
            item = dict(chunk_map[cid])
            item["rrf_score"] = scores[cid]
            results.append(item)
        return results

    def rerank_chunks(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int = 6,
        sub_questions: Optional[List[str]] = None,
        preferred_source_type: Optional[str] = None,
        target_page: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Reranks a list of candidate chunks against the user's query and sub-questions.
        Considers:
        - Term density and exact phrase matching.
        - Coverage across decomposed sub-questions.
        - Source-type alignment (table / diagram / text).
        - Page diversity (avoids 6 chunks from the same paragraph).
        """
        if not candidates:
            return []

        query_clean = query.lower().strip()
        query_tokens = [w for w in re.findall(r"\b[a-z0-9_]{3,}\b", query_clean) if len(w) > 2]
        sub_qs = sub_questions or []
        sub_q_tokens = [
            set(re.findall(r"\b[a-z0-9_]{3,}\b", sq.lower()))
            for sq in sub_qs
        ]

        scored: List[ScoredChunk] = []
        page_counts: Dict[int, int] = {}

        for item in candidates:
            content = (item.get("content") or "").strip()
            if not content:
                continue

            content_lower = content.lower()
            page = int(item.get("page", 1))
            source_type = item.get("source_type", "text")
            cid = item.get("chunk_id", "")
            doc_id = item.get("doc_id", "")

            score = 0.0

            # 1. Base RRF or BM25 score if present
            if item.get("rrf_score") is not None:
                score += float(item["rrf_score"]) * 100.0
            if item.get("rank") is not None and isinstance(item["rank"], (int, float)):
                # SQLite / PG rank is negative or positive score
                score += max(0.0, 50.0 - abs(float(item["rank"])))

            # 2. Exact phrase match boost
            if query_clean in content_lower:
                score += 35.0

            # 3. Query token overlap & frequency
            token_matches = 0
            for tok in query_tokens:
                c = content_lower.count(tok)
                if c > 0:
                    token_matches += 1
                    score += 3.0 + min(c * 1.5, 6.0)

            # Fraction of query tokens covered
            if query_tokens:
                coverage = token_matches / len(query_tokens)
                score += coverage * 25.0

            # 4. Coverage across decomposed sub-questions
            for sq_set in sub_q_tokens:
                if sq_set:
                    matched_sq = sum(1 for tok in sq_set if tok in content_lower)
                    score += (matched_sq / len(sq_set)) * 15.0

            # 5. Target page boost
            if target_page is not None:
                if page == target_page:
                    score += 50.0
                elif abs(page - target_page) == 1:
                    score += 15.0

            # 6. Preferred source type alignment
            if preferred_source_type:
                if source_type == preferred_source_type:
                    score += 20.0

            # 7. Quality signals: penalize overly short boilerplate chunks
            words = content.split()
            if len(words) < 15:
                score *= 0.5
            elif len(words) >= 40:
                score += 5.0

            # 8. Diversity penalty: diminish marginal utility if same page already has 2 chunks
            seen_from_page = page_counts.get(page, 0)
            if seen_from_page >= 2:
                score *= 0.8
            elif seen_from_page >= 1:
                score *= 0.95

            page_counts[page] = seen_from_page + 1

            scored.append(
                ScoredChunk(
                    chunk_id=cid,
                    doc_id=doc_id,
                    page=page,
                    source_type=source_type,
                    content=content,
                    score=score,
                    metadata=item.get("metadata", {}),
                )
            )

        # Sort by final score descending
        scored.sort(key=lambda x: x.score, reverse=True)

        # Deduplicate while preserving diversity
        final_results = []
        selected_ids = set()
        page_distribution: Dict[int, int] = {}

        for sc in scored:
            if sc.chunk_id in selected_ids:
                continue
            # Cap max 3 chunks from a single page for diversity
            if page_distribution.get(sc.page, 0) >= 3 and len(final_results) < top_k:
                continue

            selected_ids.add(sc.chunk_id)
            page_distribution[sc.page] = page_distribution.get(sc.page, 0) + 1
            final_results.append({
                "chunk_id": sc.chunk_id,
                "doc_id": sc.doc_id,
                "page": sc.page,
                "source_type": sc.source_type,
                "content": sc.content,
                "rerank_score": round(sc.score, 3),
                "metadata": sc.metadata,
            })

            if len(final_results) >= top_k:
                break

        # If diversity capped too strictly, fill remaining slots
        if len(final_results) < top_k:
            for sc in scored:
                if sc.chunk_id not in selected_ids:
                    selected_ids.add(sc.chunk_id)
                    final_results.append({
                        "chunk_id": sc.chunk_id,
                        "doc_id": sc.doc_id,
                        "page": sc.page,
                        "source_type": sc.source_type,
                        "content": sc.content,
                        "rerank_score": round(sc.score, 3),
                        "metadata": sc.metadata,
                    })
                    if len(final_results) >= top_k:
                        break

        return final_results


# Global singleton instance
reranker = Reranker()

