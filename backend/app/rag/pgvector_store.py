"""
PostgreSQL + pgvector Vector Store, Full-Text Engine & Central Session Database.
Handles:
1. Vector embeddings storage & cosine similarity search with HNSW indexes.
2. PostgreSQL Native Full-Text Search (tsvector + GIN index) for keyword & phrase matching.
3. Hybrid Search fusing Vector + Full-Text results via Reciprocal Rank Fusion (RRF).
4. Persistent study sessions, curriculum topics, and chat message history.
"""
import os
import re
import json
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dotenv import dotenv_values

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, execute_values
    import pgvector.psycopg2
    HAS_PG_LIBS = True
except ImportError:
    HAS_PG_LIBS = False


def _get_active_postgres_url() -> str:
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    vals = {}
    if env_path.exists():
        vals = dotenv_values(env_path)
    url = (
        vals.get("POSTGRES_URL")
        or vals.get("DATABASE_URL")
        or os.environ.get("POSTGRES_URL")
        or os.environ.get("DATABASE_URL")
        or ""
    ).strip()
    return url


class PgVectorStore:
    """
    Central PostgreSQL + pgvector unified database client.
    Replaces local SQLite FTS5 files with cloud-native PostgreSQL storage.
    """

    def __init__(self, dimension: int = 1536):
        self.dimension = dimension
        self._initialized = False
        # In-memory transient cache if database connection is pending configuration
        self._mem_sessions: Dict[str, Dict[str, Any]] = {}
        self._mem_chunks: Dict[str, List[Dict[str, Any]]] = {}

    @property
    def db_url(self) -> str:
        return _get_active_postgres_url()

    def is_configured(self) -> bool:
        url = self.db_url
        if not HAS_PG_LIBS:
            return False
        return bool(url and (url.startswith("postgres://") or url.startswith("postgresql://")))

    def _get_connection(self):
        if not self.is_configured():
            return None
        url = self.db_url
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]

        conn = psycopg2.connect(url)
        try:
            pgvector.psycopg2.register_vector(conn)
        except Exception:
            pass
        return conn

    # ─── SCHEMA INITIALIZATION ───────────────────────────────────────────────
    def initialize_schema(self) -> bool:
        """Initializes tables, pgvector extension, full-text tsvector, and vector indexes."""
        if not self.is_configured():
            print("[PgVector] POSTGRES_URL not configured. Operating in transient memory mode.")
            return False

        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return False

            with conn.cursor() as cur:
                # 1. Enable pgvector extension
                try:
                    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                    conn.commit()
                except Exception as ext_err:
                    conn.rollback()
                    print(f"[PgVector] Vector extension notice: {ext_err}")

                try:
                    pgvector.psycopg2.register_vector(conn)
                except Exception:
                    pass

                # 2. Table: study_sessions
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS study_sessions (
                        session_id VARCHAR(100) PRIMARY KEY,
                        user_id VARCHAR(100) NOT NULL DEFAULT 'default_user',
                        subject VARCHAR(255),
                        title VARCHAR(255),
                        file_name VARCHAR(255),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        metadata JSONB DEFAULT '{}'::jsonb
                    );
                    ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) NOT NULL DEFAULT 'default_user';
                    CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
                """)

                # 3. Table: session_topics
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS session_topics (
                        id VARCHAR(100),
                        session_id VARCHAR(100) REFERENCES study_sessions(session_id) ON DELETE CASCADE,
                        title VARCHAR(255),
                        summary TEXT,
                        difficulty VARCHAR(50),
                        key_concepts JSONB DEFAULT '[]'::jsonb,
                        estimated_study_time VARCHAR(50),
                        PRIMARY KEY (session_id, id)
                    );
                """)

                # 4. Table: session_messages
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS session_messages (
                        id VARCHAR(100) PRIMARY KEY,
                        session_id VARCHAR(100) REFERENCES study_sessions(session_id) ON DELETE CASCADE,
                        role VARCHAR(50),
                        text TEXT,
                        thought_process TEXT,
                        quiz_data JSONB,
                        topics JSONB,
                        attachment JSONB,
                        is_explanation BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)

                # 5. Table: document_chunks (with tsvector and pgvector columns)
                cur.execute(f"""
                    CREATE TABLE IF NOT EXISTS document_chunks (
                        chunk_id VARCHAR(120) PRIMARY KEY,
                        session_id VARCHAR(100) REFERENCES study_sessions(session_id) ON DELETE CASCADE,
                        user_id VARCHAR(100) NOT NULL DEFAULT 'default_user',
                        doc_id VARCHAR(100),
                        page_number INTEGER,
                        chunk_index INTEGER,
                        source_type VARCHAR(50),
                        content TEXT,
                        tsv_content tsvector,
                        metadata JSONB DEFAULT '{{}}'::jsonb,
                        embedding vector({self.dimension}),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) NOT NULL DEFAULT 'default_user';
                    CREATE INDEX IF NOT EXISTS idx_chunks_session ON document_chunks(session_id);
                    CREATE INDEX IF NOT EXISTS idx_chunks_user ON document_chunks(user_id);
                    CREATE INDEX IF NOT EXISTS idx_chunks_doc ON document_chunks(doc_id);
                    CREATE INDEX IF NOT EXISTS idx_chunks_page ON document_chunks(session_id, page_number);
                """)

                # Full-text search GIN index
                try:
                    cur.execute("""
                        CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON document_chunks USING GIN(tsv_content);
                    """)
                except Exception:
                    pass

                # HNSW Vector similarity index
                try:
                    cur.execute("""
                        CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw 
                        ON document_chunks USING hnsw (embedding vector_cosine_ops);
                    """)
                except Exception:
                    conn.rollback()

                conn.commit()
                self._initialized = True
                print("[PgVector] Schema, tables, and indexes initialized successfully in PostgreSQL.")
                return True
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"[PgVector] Schema initialization error: {e}")
            return False
        finally:
            if conn:
                conn.close()

    # ─── CHUNK INGESTION & STORAGE ───────────────────────────────────────────
    def index_chunks(
        self,
        chunks: List[Dict[str, Any]],
        session_id: Optional[str] = None,
        doc_id: Optional[str] = None,
        embeddings: Optional[List[List[float]]] = None,
        user_id: str = "default_user",
    ) -> int:
        """Stores chunks, generates tsvectors, and attaches vector embeddings in PostgreSQL."""
        if not chunks:
            return 0

        target_sid = session_id or chunks[0].get("session_id") or chunks[0].get("doc_id") or "default_session"
        target_doc = doc_id or chunks[0].get("doc_id") or target_sid

        # Ensure session exists first
        self.ensure_session(target_sid, user_id=user_id)

        # Fallback in-memory tracking
        if target_sid not in self._mem_chunks:
            self._mem_chunks[target_sid] = []
        for c in chunks:
            cid = c.get("chunk_id") or f"{target_doc}_p{c.get('page', 1)}_{len(self._mem_chunks[target_sid])}"
            c["chunk_id"] = cid
            c["session_id"] = target_sid
            c["doc_id"] = target_doc
            c["user_id"] = user_id
            self._mem_chunks[target_sid] = [x for x in self._mem_chunks[target_sid] if x.get("chunk_id") != cid]
            self._mem_chunks[target_sid].append(c)

        if not self.is_configured():
            return len(chunks)

        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return len(chunks)

            records = []
            for i, c in enumerate(chunks):
                cid = c.get("chunk_id") or f"{target_doc}_p{c.get('page', 1)}_{i}"
                page = c.get("page", 1)
                idx = c.get("chunk_index", i)
                stype = c.get("source_type", "text")
                content = c.get("content") or c.get("text", "")
                meta = json.dumps(c.get("metadata", {}))
                emb = embeddings[i] if (embeddings and i < len(embeddings)) else None

                records.append((
                    cid,
                    target_sid,
                    user_id,
                    target_doc,
                    page,
                    idx,
                    stype,
                    content,
                    meta,
                    emb,
                ))

            insert_query = """
                INSERT INTO document_chunks (
                    chunk_id, session_id, user_id, doc_id, page_number, chunk_index,
                    source_type, content, tsv_content, metadata, embedding
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, to_tsvector('english', coalesce(%s, '')), %s, %s
                )
                ON CONFLICT (chunk_id) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    content = EXCLUDED.content,
                    tsv_content = to_tsvector('english', coalesce(EXCLUDED.content, '')),
                    page_number = EXCLUDED.page_number,
                    source_type = EXCLUDED.source_type,
                    metadata = EXCLUDED.metadata,
                    embedding = COALESCE(EXCLUDED.embedding, document_chunks.embedding);
            """

            with conn.cursor() as cur:
                # Format parameters for batch execution
                for rec in records:
                    cur.execute(insert_query, (
                        rec[0], rec[1], rec[2], rec[3], rec[4], rec[5], rec[6], rec[7], rec[8], rec[9]
                    ))
                conn.commit()
                return len(records)
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"[PgVector] Error indexing chunks: {e}")
            return len(chunks)
        finally:
            if conn:
                conn.close()

    # ─── RETRIEVAL: FULL-TEXT SEARCH ─────────────────────────────────────────
    def text_search(
        self,
        query: str,
        doc_id: Optional[str] = None,
        session_id: Optional[str] = None,
        limit: int = 15,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Native PostgreSQL Full-Text Search using tsquery and ts_rank_cd."""
        target_sid = session_id or doc_id

        if not self.is_configured():
            return self._mem_text_search(query, target_sid, limit, user_id=user_id)

        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return self._mem_text_search(query, target_sid, limit, user_id=user_id)

            clean_q = re.sub(r"[^\w\s]", " ", query).strip()
            tokens = [w for w in clean_q.split() if len(w) > 2]
            ts_query_str = " | ".join(tokens) if tokens else query.strip()

            clauses = ["content IS NOT NULL AND content != ''"]
            params: List[Any] = []

            if target_sid:
                clauses.append("(session_id = %s OR doc_id = %s)")
                params.extend([target_sid, target_sid])

            if user_id:
                clauses.append("user_id = %s")
                params.append(user_id)

            where_sql = " AND ".join(clauses)

            sql = f"""
                SELECT 
                    chunk_id,
                    session_id,
                    doc_id,
                    page_number AS page,
                    source_type,
                    content,
                    metadata,
                    ts_rank_cd(tsv_content, plainto_tsquery('english', %s)) AS rank
                FROM document_chunks
                WHERE {where_sql} AND tsv_content @@ plainto_tsquery('english', %s)
                ORDER BY rank DESC
                LIMIT %s;
            """
            exec_params = [query] + params + [query, limit]

            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql, exec_params)
                rows = cur.fetchall()
                if rows:
                    return [dict(r) for r in rows]

                # Fallback to ILIKE if tsquery returned 0 results
                ilike_sql = f"""
                    SELECT 
                        chunk_id,
                        session_id,
                        doc_id,
                        page_number AS page,
                        source_type,
                        content,
                        metadata,
                        1.0 AS rank
                    FROM document_chunks
                    WHERE {where_sql}
                    ORDER BY created_at DESC
                    LIMIT %s;
                """
                cur.execute(ilike_sql, params + [limit])
                fallback_rows = cur.fetchall()
                return [dict(r) for r in fallback_rows]

        except Exception as e:
            print(f"[PgVector] Text search note: {e}")
            return self._mem_text_search(query, target_sid, limit)
        finally:
            if conn:
                conn.close()

    def _mem_text_search(self, query: str, session_id: Optional[str], limit: int, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if session_id:
            chunks = list(self._mem_chunks.get(session_id, []))
        else:
            chunks = [c for c_list in self._mem_chunks.values() for c in c_list]

        if user_id:
            chunks = [c for c in chunks if c.get("user_id") == user_id]

        q_words = set(re.findall(r"\w+", query.lower()))
        scored = []
        for c in chunks:
            content = c.get("content", "").lower()
            matches = sum(1 for w in q_words if w in content)
            scored.append((matches, c))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            {
                "chunk_id": c.get("chunk_id", ""),
                "session_id": c.get("session_id", ""),
                "doc_id": c.get("doc_id", ""),
                "page": c.get("page", 1),
                "source_type": c.get("source_type", "text"),
                "content": c.get("content", ""),
                "metadata": c.get("metadata", {}),
                "rank": float(s),
            }
            for s, c in scored[:limit]
            if s > 0
        ]

    # ─── RETRIEVAL: VECTOR SIMILARITY SEARCH ─────────────────────────────────
    def similarity_search(
        self,
        query_vector: List[float],
        session_id: Optional[str] = None,
        doc_id: Optional[str] = None,
        top_k: int = 6,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Cosine distance similarity search using pgvector `<=>` operator."""
        if not self.is_configured() or not query_vector:
            return []

        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return []

            clauses = ["embedding IS NOT NULL"]
            params: List[Any] = []

            target_sid = session_id or doc_id
            if target_sid:
                clauses.append("(session_id = %s OR doc_id = %s)")
                params.extend([target_sid, target_sid])

            if user_id:
                clauses.append("user_id = %s")
                params.append(user_id)

            where_sql = " AND ".join(clauses)

            query = f"""
                SELECT 
                    chunk_id,
                    session_id,
                    doc_id,
                    page_number AS page,
                    source_type,
                    content,
                    metadata,
                    1 - (embedding <=> %s) AS similarity
                FROM document_chunks
                WHERE {where_sql}
                ORDER BY embedding <=> %s
                LIMIT %s;
            """

            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                full_params = [query_vector] + params + [query_vector, top_k]
                cur.execute(query, full_params)
                rows = cur.fetchall()
                return [dict(r) for r in rows]
        except Exception as e:
            print(f"[PgVector] Vector similarity search error: {e}")
            return []
        finally:
            if conn:
                conn.close()

    # ─── RETRIEVAL: HYBRID SEARCH (VECTOR + FULL-TEXT WITH RRF) ──────────────
    def hybrid_search(
        self,
        query: str,
        query_vector: Optional[List[float]] = None,
        session_id: Optional[str] = None,
        doc_id: Optional[str] = None,
        top_k: int = 8,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Fuses Full-Text search and Vector search results using Reciprocal Rank Fusion."""
        target_sid = session_id or doc_id

        # 1. Full-Text Search Candidates
        text_candidates = self.text_search(query=query, doc_id=doc_id, session_id=target_sid, limit=top_k * 2, user_id=user_id)

        # 2. Vector Search Candidates
        vector_candidates = []
        if query_vector:
            vector_candidates = self.similarity_search(query_vector=query_vector, session_id=target_sid, doc_id=doc_id, top_k=top_k * 2, user_id=user_id)

        if not vector_candidates:
            return text_candidates[:top_k]

        # 3. Reciprocal Rank Fusion
        rrf_k = 60
        scores: Dict[str, float] = {}
        candidate_map: Dict[str, Dict[str, Any]] = {}

        for rank, item in enumerate(text_candidates):
            cid = item["chunk_id"]
            candidate_map[cid] = item
            scores[cid] = scores.get(cid, 0.0) + (1.0 / (rrf_k + rank + 1))

        for rank, item in enumerate(vector_candidates):
            cid = item["chunk_id"]
            if cid not in candidate_map:
                candidate_map[cid] = item
            scores[cid] = scores.get(cid, 0.0) + (1.2 / (rrf_k + rank + 1))  # Slightly favor semantic match

        sorted_cids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
        results = []
        for cid in sorted_cids[:top_k]:
            c = dict(candidate_map[cid])
            c["rrf_score"] = scores[cid]
            results.append(c)
        return results

    # ─── EXACT PAGE & DOCUMENT TEXT EXTRACTION ───────────────────────────────
    def get_page_chunks(self, doc_id: str, page: int, session_id: Optional[str] = None, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetches all chunks for an exact page number."""
        target_sid = session_id or doc_id
        if not self.is_configured():
            chunks = self._mem_chunks.get(target_sid, [])
            return [
                {
                    "chunk_id": c.get("chunk_id", ""),
                    "session_id": c.get("session_id", target_sid),
                    "doc_id": c.get("doc_id", doc_id),
                    "page": c.get("page", page),
                    "source_type": c.get("source_type", "text"),
                    "content": c.get("content", ""),
                }
                for c in chunks if int(c.get("page", 0)) == page
            ]

        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return []
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                clauses = ["(session_id = %s OR doc_id = %s)", "page_number = %s"]
                params: List[Any] = [target_sid, doc_id, page]
                if user_id:
                    clauses.append("user_id = %s")
                    params.append(user_id)
                where_sql = " AND ".join(clauses)

                cur.execute(f"""
                    SELECT 
                        chunk_id, session_id, doc_id, page_number AS page, source_type, content, metadata
                    FROM document_chunks
                    WHERE {where_sql}
                    ORDER BY chunk_index ASC;
                """, params)
                rows = cur.fetchall()
                return [dict(r) for r in rows]
        except Exception as e:
            print(f"[PgVector] get_page_chunks error: {e}")
            return []
        finally:
            if conn:
                conn.close()

    def get_document_text(self, doc_id: str, session_id: Optional[str] = None, max_chars: int = 12000, user_id: Optional[str] = None) -> str:
        """Retrieves aggregated document text across all chunks."""
        target_sid = session_id or doc_id
        if not self.is_configured():
            chunks = self._mem_chunks.get(target_sid, [])
            return "\n\n".join(c.get("content", "") for c in chunks)[:max_chars]

        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return ""
            with conn.cursor() as cur:
                if user_id:
                    cur.execute("""
                        SELECT content FROM document_chunks
                        WHERE (session_id = %s OR doc_id = %s)
                          AND user_id = %s
                        ORDER BY page_number ASC, chunk_index ASC
                        LIMIT 40;
                    """, (target_sid, doc_id, user_id))
                else:
                    cur.execute("""
                        SELECT content FROM document_chunks
                        WHERE (session_id = %s OR doc_id = %s)
                        ORDER BY page_number ASC, chunk_index ASC
                        LIMIT 40;
                    """, (target_sid, doc_id))
                rows = cur.fetchall()
                return "\n\n".join(r[0] for r in rows if r[0])[:max_chars]
        except Exception as e:
            print(f"[PgVector] get_document_text error: {e}")
            return ""
        finally:
            if conn:
                conn.close()

    # ─── SESSION & TOPIC & MESSAGE STATE MANAGEMENT ──────────────────────────
    def ensure_session(self, session_id: str, subject: str = "General", title: Optional[str] = None, user_id: str = "default_user"):
        """Ensures a session row exists in study_sessions."""
        if not session_id:
            return
        if not self.is_configured():
            if session_id not in self._mem_sessions:
                self._mem_sessions[session_id] = {
                    "meta": {"id": session_id, "subject": subject, "title": title or subject, "user_id": user_id},
                    "topics": [],
                    "messages": [],
                }
            return

        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO study_sessions (session_id, user_id, subject, title, updated_at)
                    VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (session_id) DO UPDATE SET
                        user_id = COALESCE(EXCLUDED.user_id, study_sessions.user_id),
                        subject = COALESCE(EXCLUDED.subject, study_sessions.subject),
                        title = COALESCE(EXCLUDED.title, study_sessions.title),
                        updated_at = CURRENT_TIMESTAMP;
                """, (session_id, user_id, subject, title or subject))
                conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"[PgVector] ensure_session error: {e}")
        finally:
            if conn:
                conn.close()

    def save_session_state(
        self,
        session_id: str,
        topics: Optional[List[Dict[str, Any]]] = None,
        subject: Optional[str] = None,
        title: Optional[str] = None,
        messages: Optional[List[Dict[str, Any]]] = None,
        file_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
    ):
        """Saves complete session state (metadata, topics, messages) to PostgreSQL."""
        if not session_id:
            return

        # Keep memory cache updated
        if session_id not in self._mem_sessions:
            self._mem_sessions[session_id] = {"meta": {}, "topics": [], "messages": []}
        mem = self._mem_sessions[session_id]
        if subject:
            mem["meta"]["subject"] = subject
        if title:
            mem["meta"]["title"] = title
        if file_name:
            mem["meta"]["file_name"] = file_name
        if user_id:
            mem["meta"]["user_id"] = user_id
        if topics is not None:
            mem["topics"] = topics
        if messages is not None:
            mem["messages"] = messages

        if not self.is_configured():
            return

        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return

            with conn.cursor() as cur:
                # 1. Upsert study_sessions
                cur.execute("""
                    INSERT INTO study_sessions (session_id, user_id, subject, title, file_name, metadata, updated_at)
                    VALUES (%s, COALESCE(%s, 'default_user'), %s, %s, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (session_id) DO UPDATE SET
                        user_id = COALESCE(EXCLUDED.user_id, study_sessions.user_id),
                        subject = COALESCE(EXCLUDED.subject, study_sessions.subject),
                        title = COALESCE(EXCLUDED.title, study_sessions.title),
                        file_name = COALESCE(EXCLUDED.file_name, study_sessions.file_name),
                        metadata = COALESCE(EXCLUDED.metadata, study_sessions.metadata),
                        updated_at = CURRENT_TIMESTAMP;
                """, (session_id, user_id, subject, title or subject, file_name, json.dumps(metadata or {})))

                # 2. Upsert topics
                if topics:
                    for i, t in enumerate(topics):
                        tid = t.get("id") or f"topic_{i+1}"
                        t_title = t.get("title", f"Topic {i+1}")
                        summary = t.get("summary", "")
                        diff = t.get("difficulty", "Beginner")
                        concepts = json.dumps(t.get("key_concepts", []))
                        est = t.get("estimated_study_time", "12-15 mins")

                        cur.execute("""
                            INSERT INTO session_topics (
                                id, session_id, title, summary, difficulty, key_concepts, estimated_study_time
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (session_id, id) DO UPDATE SET
                                title = EXCLUDED.title,
                                summary = EXCLUDED.summary,
                                difficulty = EXCLUDED.difficulty,
                                key_concepts = EXCLUDED.key_concepts,
                                estimated_study_time = EXCLUDED.estimated_study_time;
                        """, (tid, session_id, t_title, summary, diff, concepts, est))

                # 3. Upsert messages
                if messages:
                    for m in messages:
                        mid = str(m.get("id") or f"msg_{session_id}_{i}")
                        role = m.get("role", "user")
                        text = m.get("text") or m.get("content", "")
                        thought = m.get("thoughtProcess") or m.get("thought_process", "")
                        quiz = json.dumps(m.get("quizData")) if m.get("quizData") else None
                        top = json.dumps(m.get("topics")) if m.get("topics") else None
                        att = json.dumps(m.get("attachment")) if m.get("attachment") else None
                        is_expl = bool(m.get("isExplanation", True))

                        cur.execute("""
                            INSERT INTO session_messages (
                                id, session_id, role, text, thought_process, quiz_data, topics, attachment, is_explanation
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (id) DO UPDATE SET
                                text = EXCLUDED.text,
                                thought_process = EXCLUDED.thought_process,
                                quiz_data = EXCLUDED.quiz_data,
                                topics = EXCLUDED.topics;
                        """, (mid, session_id, role, text, thought, quiz, top, att, is_expl))

                conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"[PgVector] Error saving session state for {session_id}: {e}")
        finally:
            if conn:
                conn.close()

    def get_session_state(self, session_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Retrieves session metadata, topics, and messages from PostgreSQL."""
        if not self.is_configured():
            mem = self._mem_sessions.get(session_id)
            if mem and user_id and mem.get("meta", {}).get("user_id") and mem.get("meta", {}).get("user_id") != user_id:
                return None
            return mem

        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                mem = self._mem_sessions.get(session_id)
                if mem and user_id and mem.get("meta", {}).get("user_id") and mem.get("meta", {}).get("user_id") != user_id:
                    return None
                return mem

            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # 1. Fetch study_sessions
                if user_id:
                    cur.execute("""
                        SELECT session_id, user_id, subject, title, file_name, created_at, updated_at, metadata
                        FROM study_sessions WHERE session_id = %s AND user_id = %s;
                    """, (session_id, user_id))
                else:
                    cur.execute("""
                        SELECT session_id, user_id, subject, title, file_name, created_at, updated_at, metadata
                        FROM study_sessions WHERE session_id = %s;
                    """, (session_id,))
                sess_row = cur.fetchone()
                if not sess_row:
                    mem_s = self._mem_sessions.get(session_id)
                    if mem_s and user_id and mem_s.get("meta", {}).get("user_id") != user_id:
                        return None
                    return mem_s

                # 2. Fetch session_topics
                cur.execute("""
                    SELECT id, title, summary, difficulty, key_concepts, estimated_study_time
                    FROM session_topics WHERE session_id = %s
                    ORDER BY id ASC;
                """, (session_id,))
                topic_rows = cur.fetchall()
                topics = []
                for r in topic_rows:
                    kc = r["key_concepts"]
                    topics.append({
                        "id": r["id"],
                        "title": r["title"],
                        "summary": r["summary"],
                        "difficulty": r["difficulty"],
                        "key_concepts": kc if isinstance(kc, list) else json.loads(kc or "[]"),
                        "estimated_study_time": r["estimated_study_time"],
                    })

                # 3. Fetch session_messages
                cur.execute("""
                    SELECT id, role, text, thought_process, quiz_data, topics, attachment, is_explanation, created_at
                    FROM session_messages WHERE session_id = %s
                    ORDER BY created_at ASC;
                """, (session_id,))
                msg_rows = cur.fetchall()
                messages = []
                for m in msg_rows:
                    qd = m["quiz_data"]
                    tp = m["topics"]
                    att = m["attachment"]
                    messages.append({
                        "id": m["id"],
                        "role": m["role"],
                        "text": m["text"],
                        "thoughtProcess": m["thought_process"],
                        "quizData": qd if (isinstance(qd, dict) or qd is None) else json.loads(qd),
                        "topics": tp if (isinstance(tp, list) or tp is None) else json.loads(tp),
                        "attachment": att if (isinstance(att, dict) or att is None) else json.loads(att),
                        "isExplanation": m["is_explanation"],
                    })

                return {
                    "meta": {
                        "id": sess_row["session_id"],
                        "user_id": sess_row.get("user_id"),
                        "subject": sess_row["subject"],
                        "title": sess_row["title"],
                        "file_name": sess_row["file_name"],
                    },
                    "topics": topics,
                    "messages": messages,
                }
        except Exception as e:
            print(f"[PgVector] get_session_state error for {session_id}: {e}")
            return self._mem_sessions.get(session_id)
        finally:
            if conn:
                conn.close()

    def get_all_sessions(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lists all study sessions stored in PostgreSQL, partitioned by user_id."""
        if not self.is_configured():
            if user_id:
                return [v.get("meta", {}) for v in self._mem_sessions.values() if v.get("meta", {}).get("user_id") == user_id]
            return [v.get("meta", {}) for v in self._mem_sessions.values()]

        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return []
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if user_id:
                    cur.execute("""
                        SELECT session_id AS id, user_id, subject, title, file_name, created_at, updated_at
                        FROM study_sessions
                        WHERE user_id = %s
                        ORDER BY updated_at DESC;
                    """, (user_id,))
                else:
                    cur.execute("""
                        SELECT session_id AS id, user_id, subject, title, file_name, created_at, updated_at
                        FROM study_sessions
                        ORDER BY updated_at DESC;
                    """)
                rows = cur.fetchall()
                return [dict(r) for r in rows]
        except Exception as e:
            print(f"[PgVector] get_all_sessions error: {e}")
            return []
        finally:
            if conn:
                conn.close()

    def clear_session(self, session_id: str, user_id: Optional[str] = None) -> bool:
        """Cascades deletion of a session and its topics, messages, and chunks."""
        self._mem_sessions.pop(session_id, None)
        self._mem_chunks.pop(session_id, None)

        if not self.is_configured():
            return True

        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return False
            with conn.cursor() as cur:
                if user_id:
                    cur.execute("DELETE FROM study_sessions WHERE session_id = %s AND user_id = %s;", (session_id, user_id))
                else:
                    cur.execute("DELETE FROM study_sessions WHERE session_id = %s;", (session_id,))
                conn.commit()
                return True
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"[PgVector] Error clearing session {session_id}: {e}")
            return False
        finally:
            if conn:
                conn.close()

    def clear_all(self) -> bool:
        """Clears all sessions and chunks."""
        self._mem_sessions.clear()
        self._mem_chunks.clear()

        if not self.is_configured():
            return True

        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return False
            with conn.cursor() as cur:
                cur.execute("TRUNCATE study_sessions, document_chunks CASCADE;")
                conn.commit()
                return True
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"[PgVector] Error clearing all tables: {e}")
            return False
        finally:
            if conn:
                conn.close()

    def delete_document(self, doc_id: str) -> bool:
        """Deletes all chunks belonging to doc_id."""
        if not self.is_configured():
            return True

        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return False
            with conn.cursor() as cur:
                cur.execute("DELETE FROM document_chunks WHERE doc_id = %s;", (doc_id,))
                conn.commit()
                return True
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"[PgVector] Error deleting document chunks: {e}")
            return False
        finally:
            if conn:
                conn.close()


# Central singleton instance
pgvector_store = PgVectorStore()
