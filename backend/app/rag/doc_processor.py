"""
Document Processor — Multi-stage Document Processing Pipeline with Fast-Path & Background Enrichment.

Stages:
[Stage 0] Save file, register doc_id, status = "processing_text"
[Stage 1 — FAST PATH, ~seconds]
  - Extract text per page
  - Chunk into 500-800 characters with ~15% overlap
  - Store chunks with metadata: { doc_id, page, source_type: "text" }
  - status = "text_ready" (User can ask questions immediately)
[Stage 2 — TABLE EXTRACTION, background task]
  - pdfplumber.extract_tables()
  - Convert tables to Markdown strings
  - Store chunks with metadata: { doc_id, page, source_type: "table" }
[Stage 3 — IMAGE EXTRACTION & CAPTIONING, background task]
  - Extract embedded images from PDF pages
  - Vision-caption each image using Gemini VLM
  - Store captions with metadata: { doc_id, page, source_type: "image_caption" }
  - status = "fully_processed"
"""
import os
import io
import re
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

import pypdf
import pdfplumber
from PIL import Image

from app.rag.vlm_client import GeminiVLMClient, _get_active_gemini_key
from app.rag.sqlite_fts_store import sqlite_fts_store, get_session_store
import httpx



@dataclass
class DocumentChunk:
    chunk_id: str
    doc_id: str
    page: int
    source_type: str  # "text" | "table" | "image_caption"
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DocumentRecord:
    doc_id: str
    file_path: str
    file_name: str
    subject: str
    session_id: Optional[str] = None
    status: str = "processing_text"  # "processing_text" | "text_ready" | "processing_enrichment" | "fully_processed" | "error"
    chunks: List[DocumentChunk] = field(default_factory=list)
    stats: Dict[str, int] = field(default_factory=lambda: {"text_chunks": 0, "tables": 0, "images": 0})
    error_message: Optional[str] = None



class DocumentProcessor:
    """
    Manages document ingestion, chunking, background table/image extraction,
    and metadata-tagged context retrieval.
    """

    def __init__(self):
        self._docs: Dict[str, DocumentRecord] = {}
        self.vlm = GeminiVLMClient()

    def get_document(self, doc_id: str) -> Optional[DocumentRecord]:
        return self._docs.get(doc_id)

    # ─── STAGE 1: INGESTION (Fast Text + VLM OCR for Scanned/Images) ─────
    async def ingest_document(
        self,
        doc_id: str,
        file_path: str,
        file_name: str,
        subject: str = "General",
        session_id: Optional[str] = None,
    ) -> DocumentRecord:
        """
        Stage 1: Multi-modal document ingestion.
        - Plain text/code: Direct read & chunk.
        - Digital PDF: Fast text extraction via pypdf.
        - Scanned PDF / Image: OCR & transcription via Google Gemini VLM.
        """
        doc = DocumentRecord(
            doc_id=doc_id,
            file_path=file_path,
            file_name=file_name,
            subject=subject,
            session_id=session_id,
            status="processing_text",
        )
        self._docs[doc_id] = doc

        ext = Path(file_path).suffix.lower()

        # 1. Plain text / code / markdown files
        if ext in {".txt", ".md", ".py", ".csv", ".json"}:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    full_text = f.read()
                chunks = self._chunk_text(full_text, doc_id=doc_id, page=1, source_type="text")
                doc.chunks.extend(chunks)
                doc.stats["text_chunks"] = len(chunks)
                doc.status = "fully_processed"
                store = get_session_store(session_id)
                store.index_chunks([
                    {"chunk_id": c.chunk_id, "doc_id": c.doc_id, "page": c.page, "source_type": c.source_type, "content": c.content}
                    for c in chunks
                ])
                return doc
            except Exception as e:
                doc.status = "error"
                doc.error_message = str(e)
                return doc

        # 2. Standalone image files (.png, .jpg, .jpeg, .webp, .bmp, .tiff)
        if ext in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif"}:
            try:
                print(f"[DocProcessor] Image file detected: {file_name}. Transcribing using Gemini VLM...")
                with open(file_path, "rb") as f:
                    img_bytes = f.read()

                mime = "image/png" if ext == ".png" else "image/jpeg"
                vlm_text = await self.vlm.extract_text_from_image(
                    img_bytes, mime_type=mime, context_hint=subject
                )

                if vlm_text and vlm_text.strip():
                    chunks = self._chunk_text(vlm_text, doc_id=doc_id, page=1, source_type="text")
                    doc.chunks.extend(chunks)
                    doc.stats["text_chunks"] = len(chunks)
                    store = get_session_store(session_id)
                    store.index_chunks([
                        {"chunk_id": c.chunk_id, "doc_id": c.doc_id, "page": c.page, "source_type": c.source_type, "content": c.content}
                        for c in chunks
                    ])
                    print(f"[DocProcessor] Successfully extracted {len(chunks)} text chunks from image with VLM.")
                else:
                    print(f"[DocProcessor] VLM returned empty text for image {file_name}")

                doc.status = "fully_processed"
                return doc
            except Exception as e:
                print(f"[DocProcessor] Image VLM extraction error: {e}")
                doc.status = "error"
                doc.error_message = str(e)
                return doc

        # 3. PDF documents (digital or scanned)
        if ext == ".pdf":
            try:
                reader = pypdf.PdfReader(file_path)
                total_pages = len(reader.pages)
                text_chunks: List[DocumentChunk] = []
                scanned_pages_to_vlm: List[int] = []

                # Fast pass: check extractable digital text per page
                for page_idx in range(total_pages):
                    page_num = page_idx + 1
                    try:
                        page_text = reader.pages[page_idx].extract_text() or ""
                    except Exception:
                        page_text = ""

                    # If page text is rich enough, chunk it directly
                    if len(page_text.strip()) >= 40:
                        chunks = self._chunk_text(
                            page_text,
                            doc_id=doc_id,
                            page=page_num,
                            source_type="text"
                        )
                        text_chunks.extend(chunks)
                    else:
                        # Page has no or negligible text -> Scanned page!
                        scanned_pages_to_vlm.append(page_idx)

                # If scanned pages exist, use Gemini VLM to extract text from images
                if scanned_pages_to_vlm:
                    print(f"[DocProcessor] Scanned PDF detected ({len(scanned_pages_to_vlm)}/{total_pages} scanned pages). Running Gemini VLM OCR...")
                    # In fast path, process up to the first 5 scanned pages immediately
                    fast_scanned = scanned_pages_to_vlm[:5]
                    for page_idx in fast_scanned:
                        page_num = page_idx + 1
                        page_img = self.vlm.render_pdf_page_to_image(file_path, page_idx=page_idx, dpi=150)
                        if page_img:
                            page_ocr_text = await self.vlm.extract_text_from_image(
                                page_img, mime_type="image/png", context_hint=subject
                            )
                            if page_ocr_text and page_ocr_text.strip():
                                chunks = self._chunk_text(
                                    page_ocr_text,
                                    doc_id=doc_id,
                                    page=page_num,
                                    source_type="text"
                                )
                                text_chunks.extend(chunks)
                                print(f"[DocProcessor] VLM transcribed scanned PDF Page {page_num} -> {len(chunks)} chunks.")

                doc.chunks.extend(text_chunks)
                doc.stats["text_chunks"] = len(text_chunks)
                doc.status = "text_ready"

                # Persist to local session-isolated SQLite FTS5 index
                store = get_session_store(session_id)
                store.index_chunks([
                    {"chunk_id": c.chunk_id, "doc_id": c.doc_id, "page": c.page, "source_type": c.source_type, "content": c.content}
                    for c in text_chunks
                ])
                print(f"[DocProcessor] Fast path completed: {len(text_chunks)} text chunks indexed for doc {doc_id}.")
            except Exception as e:
                print(f"[DocProcessor] Fast path text extraction error: {e}")
                doc.status = "text_ready"

        return doc

    def get_document_text(self, doc_id: str, max_chars: int = 12000) -> str:
        """
        Retrieves clean assembled text of the document across all chunks
        for feeding into the LLM/Teaching Engine/Exam Engine.
        """
        doc = self._docs.get(doc_id)
        if doc and doc.chunks:
            text_pieces = [c.content for c in doc.chunks if c.source_type == "text"]
            if not text_pieces:
                text_pieces = [c.content for c in doc.chunks]
            full = "\n\n".join(text_pieces)
            return full[:max_chars]

        # Fallback to session store SQLite search
        store = get_session_store(doc_id)
        matches = store.search(doc_id=doc_id, query="*", limit=20)
        if matches:
            return "\n\n".join(m["content"] for m in matches)[:max_chars]
        return ""

    # ─── STAGE 2 & 3: ASYNC BACKGROUND ENRICHMENT ─────────────────────────
    async def run_background_enrichment(self, doc_id: str):
        """
        Non-blocking background task to:
        1. OCR any remaining scanned PDF pages beyond page 5
        2. Extract tables (Stage 2)
        3. Extract & caption diagram images with Gemini VLM (Stage 3)
        Appends chunks directly to the active document and local SQLite FTS5 store.
        """
        doc = self._docs.get(doc_id)
        if not doc or not os.path.exists(doc.file_path):
            return

        ext = Path(doc.file_path).suffix.lower()
        if ext != ".pdf":
            doc.status = "fully_processed"
            return

        doc.status = "processing_enrichment"

        # ── Stage 1.5: OCR remaining scanned pages (> page 5) ──
        try:
            reader = pypdf.PdfReader(doc.file_path)
            total_pages = len(reader.pages)
            if total_pages > 5:
                for page_idx in range(5, total_pages):
                    page_num = page_idx + 1
                    try:
                        p_text = reader.pages[page_idx].extract_text() or ""
                    except Exception:
                        p_text = ""

                    if len(p_text.strip()) < 40:
                        page_img = self.vlm.render_pdf_page_to_image(doc.file_path, page_idx=page_idx, dpi=150)
                        if page_img:
                            ocr_text = await self.vlm.extract_text_from_image(
                                page_img, mime_type="image/png", context_hint=doc.subject
                            )
                            if ocr_text and ocr_text.strip():
                                chunks = self._chunk_text(ocr_text, doc_id=doc_id, page=page_num, source_type="text")
                                doc.chunks.extend(chunks)
                                doc.stats["text_chunks"] += len(chunks)
                                store = get_session_store(doc.session_id)
                                store.index_chunks([
                                    {"chunk_id": c.chunk_id, "doc_id": c.doc_id, "page": c.page, "source_type": c.source_type, "content": c.content}
                                    for c in chunks
                                ])
        except Exception as e:
            print(f"[DocProcessor] Background scanned page OCR warning: {e}")

        # ── Stage 2: Table Extraction ──
        try:
            table_chunks = await asyncio.to_thread(self._extract_tables_from_pdf, doc.file_path, doc_id)
            if table_chunks:
                doc.chunks.extend(table_chunks)
                doc.stats["tables"] = len(table_chunks)
                store = get_session_store(doc.session_id)
                store.index_chunks([
                    {"chunk_id": c.chunk_id, "doc_id": c.doc_id, "page": c.page, "source_type": c.source_type, "content": c.content}
                    for c in table_chunks
                ])
                print(f"[DocProcessor] Stage 2 Complete: Extracted & indexed {len(table_chunks)} tables for doc {doc_id}")
        except Exception as e:
            print(f"[DocProcessor] Stage 2 Table Extraction warning: {e}")

        # ── Stage 3: Image Extraction & VLM Captioning ──
        try:
            image_chunks = await self._extract_and_caption_images(doc.file_path, doc_id)
            if image_chunks:
                doc.chunks.extend(image_chunks)
                doc.stats["images"] = len(image_chunks)
                store = get_session_store(doc.session_id)
                store.index_chunks([
                    {"chunk_id": c.chunk_id, "doc_id": c.doc_id, "page": c.page, "source_type": c.source_type, "content": c.content}
                    for c in image_chunks
                ])
                print(f"[DocProcessor] Stage 3 Complete: Extracted & captioned {len(image_chunks)} images for doc {doc_id}")
        except Exception as e:
            print(f"[DocProcessor] Stage 3 Image Captioning warning: {e}")

        doc.status = "fully_processed"
        print(f"[DocProcessor] Document {doc_id} is now FULLY_PROCESSED. Total chunks in local SQLite FTS5: {len(doc.chunks)} (Text: {doc.stats['text_chunks']}, Tables: {doc.stats['tables']}, Images: {doc.stats['images']})")


    # ─── TABLE EXTRACTION HELPER ──────────────────────────────────────────
    def _extract_tables_from_pdf(self, file_path: str, doc_id: str) -> List[DocumentChunk]:
        """Extracts tables per page using pdfplumber and formats them as Markdown tables."""
        table_chunks: List[DocumentChunk] = []
        try:
            with pdfplumber.open(file_path) as pdf:
                for page_idx, page in enumerate(pdf.pages):
                    page_num = page_idx + 1
                    tables = page.extract_tables()
                    for t_idx, table in enumerate(tables):
                        if not table or len(table) < 2:
                            continue

                        # Clean and format into markdown table
                        md_table = self._format_table_as_markdown(table)
                        if md_table.strip():
                            chunk = DocumentChunk(
                                chunk_id=f"{doc_id}_p{page_num}_tbl_{t_idx + 1}",
                                doc_id=doc_id,
                                page=page_num,
                                source_type="table",
                                content=md_table,
                                metadata={"table_index": t_idx + 1, "rows": len(table), "cols": len(table[0]) if table else 0}
                            )
                            table_chunks.append(chunk)
        except Exception as e:
            print(f"[DocProcessor] pdfplumber table error: {e}")
        return table_chunks

    def _format_table_as_markdown(self, table: List[List[Any]]) -> str:
        """Converts raw table rows into clean, structured Markdown table."""
        if not table:
            return ""

        # Normalize cells
        cleaned_rows = []
        for row in table:
            cleaned_row = [str(cell).replace("\n", " ").strip() if cell is not None else "" for cell in row]
            cleaned_rows.append(cleaned_row)

        if not cleaned_rows:
            return ""

        headers = cleaned_rows[0]
        # Ensure header is not all empty
        if not any(headers):
            headers = [f"Col {i+1}" for i in range(len(headers))]

        col_count = len(headers)
        md_lines = []
        md_lines.append("| " + " | ".join(headers) + " |")
        md_lines.append("| " + " | ".join(["---"] * col_count) + " |")

        for row in cleaned_rows[1:]:
            # Pad or truncate row to match col_count
            padded = row + [""] * (col_count - len(row)) if len(row) < col_count else row[:col_count]
            md_lines.append("| " + " | ".join(padded) + " |")

        return "\n".join(md_lines)

    # ─── IMAGE EXTRACTION & VLM CAPTIONING HELPER ─────────────────────────
    async def _extract_and_caption_images(self, file_path: str, doc_id: str, max_images: int = 10) -> List[DocumentChunk]:
        """Extracts images from PDF pages and runs Gemini VLM factual captioning."""
        image_chunks: List[DocumentChunk] = []

        try:
            reader = pypdf.PdfReader(file_path)
            extracted_count = 0

            for page_idx, page in enumerate(reader.pages):
                page_num = page_idx + 1
                if extracted_count >= max_images:
                    break

                try:
                    page_images = list(page.images)
                except Exception:
                    page_images = []

                for img_idx, img_obj in enumerate(page_images):
                    if extracted_count >= max_images:
                        break

                    try:
                        img_bytes = img_obj.data
                        # Filter out tiny icon-sized images
                        if len(img_bytes) < 4000:
                            continue

                        pil_img = Image.open(io.BytesIO(img_bytes))
                        if pil_img.width < 100 or pil_img.height < 100:
                            continue

                        caption = await self._caption_image_with_vlm(img_bytes)
                        if caption and len(caption.strip()) > 10:
                            chunk = DocumentChunk(
                                chunk_id=f"{doc_id}_p{page_num}_img_{img_idx + 1}",
                                doc_id=doc_id,
                                page=page_num,
                                source_type="image_caption",
                                content=f"Figure/Diagram on Page {page_num}: {caption.strip()}",
                                metadata={"image_name": getattr(img_obj, 'name', 'img'), "dimensions": f"{pil_img.width}x{pil_img.height}"}
                            )
                            image_chunks.append(chunk)
                            extracted_count += 1
                    except Exception as img_err:
                        continue


        except Exception as e:
            print(f"[DocProcessor] PDF Image extraction error: {e}")

        return image_chunks

    async def _caption_image_with_vlm(self, image_bytes: bytes) -> str:
        """Calls Gemini Vision API with the factual captioning prompt."""
        api_key = _get_active_gemini_key()
        if not api_key:
            return ""

        import base64
        b64_data = base64.b64encode(image_bytes).decode("utf-8")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

        prompt = (
            "Describe this figure/diagram/chart factually, including any labels, "
            "axis values, or numbers visible. Be concise, precise, and objective."
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": b64_data,
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 300}
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text", "").strip()
        except Exception as e:
            print(f"[DocProcessor] VLM Caption call failed: {e}")

        return ""

    # ─── CHUNKING UTILITY ─────────────────────────────────────────────────
    def _chunk_text(
        self,
        text: str,
        doc_id: str,
        page: int,
        source_type: str = "text",
        chunk_size: int = 700,
        overlap: int = 100,
    ) -> List[DocumentChunk]:
        """Chunks text with 500-800 character windows and ~15% overlap."""
        cleaned = re.sub(r"\s+", " ", text).strip()
        if not cleaned:
            return []

        chunks: List[DocumentChunk] = []
        start = 0
        chunk_idx = 1

        while start < len(cleaned):
            end = start + chunk_size
            chunk_content = cleaned[start:end].strip()

            if chunk_content:
                chunk = DocumentChunk(
                    chunk_id=f"{doc_id}_p{page}_c{chunk_idx}",
                    doc_id=doc_id,
                    page=page,
                    source_type=source_type,
                    content=chunk_content,
                )
                chunks.append(chunk)
                chunk_idx += 1

            if end >= len(cleaned):
                break
            start += chunk_size - overlap

        return chunks

    # ─── QUERY RETRIEVAL FLOW ─────────────────────────────────────────────
    def retrieve_context(
        self,
        doc_id: str,
        query: str,
        top_k: int = 6,
        session_id: Optional[str] = None,
    ) -> Tuple[str, str, Dict[str, Any]]:

        """
        Retrieves top-k relevant chunks across ALL source_types (text, table, image_caption),
        with specialized routing for table-related queries.

        Returns:
          - formatted_context_block (with source_type and page tags)
          - doc_status_note (if still processing background enrichment)
          - debug_metadata
        """
        doc = self._docs.get(doc_id)
        if not doc or not doc.chunks:
            return "", "", {"status": "no_document", "total_chunks": 0}

        query_lower = query.lower().strip()
        table_keywords = {"table", "value", "compare", "how many", "number", "data", "columns", "rows", "statistic", "percent", "metric", "versus", "vs"}
        is_table_query = any(re.search(rf"\b{re.escape(kw)}\b", query_lower) for kw in table_keywords)

        # Detect specific Figure / Table identifiers e.g. "fig. 3.4", "figure 3.4", "fig 2", "table 1.1"
        fig_refs = re.findall(r"\b(?:fig(?:ure)?\.?\s*\d+(?:\.\d+)?|table\s*\d+(?:\.\d+)?)\b", query_lower)
        # Also clean raw numeric identifiers like "3.4" if preceded by fig
        clean_fig_patterns = []
        for ref in fig_refs:
            num_match = re.search(r"\d+(?:\.\d+)?", ref)
            if num_match:
                num = num_match.group(0)
                clean_fig_patterns.append(rf"\bfig(?:ure)?\.?\s*{re.escape(num)}\b")

        # Tokenize query including numbers and short domain terms (e.g. "3.4", "rf", "knn", "kul")
        query_words = set(re.findall(r"[a-z0-9]+(?:\.[a-z0-9]+)?", query_lower))

        scored_chunks: List[Tuple[float, DocumentChunk]] = []

        for chunk in doc.chunks:
            score = 0.0
            content_lower = chunk.content.lower()

            # Exact Figure / Table reference match (Massive priority boost)
            for pat in clean_fig_patterns:
                if re.search(pat, content_lower):
                    score += 30.0

            # Keyword matching score
            for word in query_words:
                count = content_lower.count(word)
                if count > 0:
                    score += 1.0 + min(count * 0.5, 3.0)

            # Boost table chunks if query asks about tables/values
            if is_table_query and chunk.source_type == "table":
                score *= 2.2
                score += 2.0

            # Boost image_caption chunks if query asks about diagram/figure/chart/graph
            if any(w in query_lower for w in ["diagram", "figure", "chart", "graph", "plot", "image"]) and chunk.source_type == "image_caption":
                score *= 2.2
                score += 2.0

            # Phrase exact match bonus
            if len(query_lower) > 4 and query_lower in content_lower:
                score += 8.0

            if score > 0:
                scored_chunks.append((score, chunk))


        # Sort descending by relevance score
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        selected_chunks = [c for _, c in scored_chunks[:top_k]]

        # Fallback to local SQLite FTS5 BM25 search if memory chunks are empty or no match
        if not selected_chunks:
            store = get_session_store(session_id or getattr(doc, "session_id", None))
            fts_matches = store.search(doc_id=doc_id, query=query, limit=top_k)
            for m in fts_matches:
                selected_chunks.append(
                    DocumentChunk(
                        chunk_id=m["chunk_id"],
                        doc_id=m["doc_id"],
                        page=m["page"],
                        source_type=m["source_type"],
                        content=m["content"],
                    )
                )


        if not selected_chunks and doc.chunks:
            selected_chunks = doc.chunks[:3]


        # Build formatted context block cleanly
        context_blocks = []
        for c in selected_chunks:
            context_blocks.append(c.content.strip())

        formatted_context = "\n\n".join(context_blocks)


        # Check doc status
        status_note = ""
        if doc.status in {"processing_text", "text_ready", "processing_enrichment"}:
            status_note = (
                "Note: This document is still processing its tables/images — "
                "I can answer from the text for now, and give you a fuller answer in a moment."
            )

        metadata = {
            "doc_id": doc_id,
            "status": doc.status,
            "total_chunks": len(doc.chunks),
            "retrieved_count": len(selected_chunks),
            "source_types_retrieved": list({c.source_type for c in selected_chunks}),
        }

        return formatted_context, status_note, metadata


# Global singleton instance
doc_processor = DocumentProcessor()
