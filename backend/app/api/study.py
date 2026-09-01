"""
Study Page API — 100% Dedicated & Standalone Study Room Router:
1. Multi-Stage Document Ingestion (Fast-path Text + Background Tables & Image VLM)
2. Intelligent Decision Agent with Source-Type Awareness and Page Citations
3. Normal Mode: Core idea distillation & interactive doubt resolution
4. Teacher Mode: Step-by-step teaching stream (Intro -> Explanation -> Deep Dive)
5. Comprehensive mixed examination (written, quiz, fill-in-the-blank) & scoring
"""
import os
import re
import json
import uuid
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.s3_client import s3_storage
from app.rag.topic_extractor import topic_extractor
from app.rag.teaching_engine import teaching_engine
from app.rag.exam_generator import exam_generator
from app.rag.decision_agent import decision_agent
from app.rag.doc_processor import doc_processor
from app.rag.user_memory import user_memory_store
from app.rag.session_manager import session_manager

settings = get_settings()
router = APIRouter(prefix="/study", tags=["study"])

# In-memory session store for fast active study flows
_study_sessions: Dict[str, Dict[str, Any]] = {}


class SessionCreateRequest(BaseModel):
    subject: Optional[str] = "General"
    title: Optional[str] = None


class SessionStatePayload(BaseModel):
    messages: Optional[List[Dict[str, Any]]] = None
    topics: Optional[List[Dict[str, Any]]] = None
    subject: Optional[str] = None
    title: Optional[str] = None


class AgentMessageRequest(BaseModel):
    message: str
    current_subject: Optional[str] = None
    session_id: Optional[str] = None
    user_id: Optional[str] = "default_user"
    user_name: Optional[str] = "Student"
    difficulty: Optional[str] = "standard"  # "standard" | "easier"
    history: Optional[List[Dict[str, str]]] = None



class FeedbackRequest(BaseModel):
    user_id: Optional[str] = "default_user"
    action: str  # "confirm_good" | "make_easier"
    concept: Optional[str] = None
    subject: Optional[str] = None


class UserFactRequest(BaseModel):
    fact: Optional[str] = None
    learning_style: Optional[str] = None
    goal: Optional[str] = None
    weakness: Optional[str] = None


class DoubtRequest(BaseModel):
    session_id: str
    topic_id: str
    topic_title: str
    question: str
    user_id: Optional[str] = "default_user"
    history: Optional[List[Dict[str, str]]] = None


class CoreIdeaRequest(BaseModel):
    session_id: str
    topic_id: str
    topic_title: str
    topic_summary: Optional[str] = ""


class ExamRequest(BaseModel):
    session_id: str
    topic_id: str
    topic_title: str


class EvaluateRequest(BaseModel):
    session_id: str
    topic_id: str
    questions: List[Dict[str, Any]]
    answers: Dict[str, str]


# ─── Sessions Workspace Endpoints ───────────────────────────────────────────────
@router.get("/sessions")
async def list_study_sessions():
    """List all study sessions with metadata."""
    return session_manager.list_sessions()


@router.post("/sessions/new")
async def create_new_session(body: Optional[SessionCreateRequest] = None):
    """Create a fresh study session and initialize its physical SQLite DB."""
    sub = body.subject if body else "General"
    title = body.title if body else None
    return session_manager.create_session(subject=sub, title=title)


@router.get("/sessions/{session_id}")
async def get_study_session(session_id: str):
    """Load session state, topics, and conversation messages."""
    return session_manager.load_session_state(session_id)


@router.post("/sessions/{session_id}/state")
async def save_study_session_state(session_id: str, body: SessionStatePayload):
    """Persist messages, topics, and subject for a session."""
    session_manager.save_session_state(
        session_id=session_id,
        messages=body.messages,
        topics=body.topics,
        subject=body.subject,
        title=body.title,
    )
    return {"success": True}


@router.delete("/sessions/{session_id}")
async def delete_study_session(session_id: str):
    """Delete a study session and remove its isolated SQLite database."""
    session_manager.delete_session(session_id)
    if session_id in _study_sessions:
        del _study_sessions[session_id]
    return {"success": True}


# ─── 0. Intelligent Decision Agent ───────────────────────────────────────────────
@router.post("/agent/message")
async def chat_with_decision_agent(body: AgentMessageRequest):
    """
    Intelligent Agent endpoint that understands greetings, detects study subjects,
    and directly answers questions from uploaded study materials using source_type tagged
    retrieval (text, table, image_caption) with student memory personalization,
    DeepTutor 5-part explanation structure, and difficulty levels.
    """
    context = ""
    file_name = None
    doc_status_note = ""
    user_id = body.user_id or "default_user"

    if body.session_id:
        if body.session_id in _study_sessions:
            session = _study_sessions[body.session_id]
            file_name = session.get("file_name")
            if not body.current_subject:
                body.current_subject = session.get("subject")
        else:
            saved_state = session_manager.get_session_state(body.session_id)
            if saved_state and saved_state.get("meta"):
                file_name = saved_state["meta"].get("file_name")
                if not body.current_subject:
                    body.current_subject = saved_state["meta"].get("subject")
                _study_sessions[body.session_id] = {
                    "id": body.session_id,
                    "subject": saved_state["meta"].get("subject", "General"),
                    "file_name": file_name,
                    "title": saved_state["meta"].get("title"),
                    "topics": saved_state.get("topics", []),
                }

        effective_query = body.message
        if len(effective_query.strip()) <= 5 and body.history:
            for h in reversed(body.history):
                if h.get("role") == "user" and len(h.get("content", "")) > 5:
                    effective_query = f"{h.get('content')} {effective_query}"
                    break

        # Retrieve top chunks with source_type metadata & table/image routing from session store
        context, doc_status_note, _ = doc_processor.retrieve_context(
            doc_id=body.session_id,
            query=effective_query,
            top_k=6,
            session_id=body.session_id,
        )



    decision = await decision_agent.analyze_and_respond(
        message=body.message,
        current_subject=body.current_subject,
        history=body.history,
        context=context,
        file_name=file_name,
        doc_status_note=doc_status_note,
        user_id=user_id,
        user_name=body.user_name,
        difficulty=body.difficulty or "standard",
    )
    return decision


@router.post("/feedback")
async def record_explanation_feedback(body: FeedbackRequest):
    """Records whether an explanation was clear ('confirm_good') or needed simplification ('make_easier')."""
    user_id = body.user_id or "default_user"
    if body.action == "confirm_good" and body.concept:
        user_memory_store.record_studied_topic(user_id, body.concept, body.subject or "General")
    elif body.action == "make_easier" and body.concept:
        user_memory_store.record_weakness(user_id, f"Needs simplified analogies for {body.concept}")
    return {"success": True, "action": body.action}



# ─── Student Memory Endpoints ──────────────────────────────────────────────────
@router.get("/memory/{user_id}")
async def get_student_memory(user_id: str = "default_user"):
    """Returns the persistent learning profile and memory for a student."""
    mem = user_memory_store.get_memory(user_id)
    return {
        "user_id": mem.user_id,
        "name": mem.name,
        "learning_style": mem.learning_style,
        "active_goals": mem.active_goals,
        "studied_topics": mem.studied_topics,
        "weaknesses": mem.weaknesses,
        "facts": mem.facts,
        "last_active": mem.last_active,
    }


@router.post("/memory/{user_id}/fact")
async def update_student_memory(user_id: str, body: UserFactRequest):
    """Manually add or update a student preference, goal, or struggle concept."""
    if body.fact:
        user_memory_store.add_fact(user_id, body.fact)
    if body.learning_style:
        user_memory_store.set_learning_style(user_id, body.learning_style)
    if body.goal:
        user_memory_store.add_goal(user_id, body.goal)
    if body.weakness:
        user_memory_store.record_weakness(user_id, body.weakness)

    return {"success": True, "memory": user_memory_store.get_memory(user_id)}


@router.delete("/memory/{user_id}")
async def clear_student_memory(user_id: str):
    """Resets memory for a specific student."""
    user_memory_store.clear_memory(user_id)
    return {"success": True, "message": f"Memory cleared for user {user_id}"}



# ─── 1. Upload & Multi-Stage Processing Pipeline ──────────────────────────────────
@router.post("/upload")
async def upload_study_material(
    file: UploadFile = File(...),
    subject: str = Form("General Subject"),
    session_id: Optional[str] = Form(None),
):
    """
    Accepts study materials:
    - [Stage 0]: Save file & create/bind to session_id
    - [Stage 1]: Fast-path text extraction and chunking (blocking, sub-seconds)
    - [Stage 2 & 3]: Background enrichment for tables & image captions (non-blocking)
    - Topic extraction in <5 seconds
    """
    study_id = session_id if (session_id and session_id.strip()) else f"session_{uuid.uuid4().hex[:10]}"
    session_manager.init_session_database(study_id)

    upload_dir = Path(settings.UPLOAD_DIR) / study_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = str(upload_dir / file.filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Cloud Storage: Upload document to AWS S3 bucket in background
    s3_key = f"documents/{study_id}/{file.filename}"
    asyncio.create_task(asyncio.to_thread(s3_storage.upload_file, file_path, s3_key, file.content_type))

    # Run Stage 1 Ingestion (Chunking/Indexing) and Topic Extraction concurrently in PARALLEL
    async def _safe_extract_topics():
        try:
            return await asyncio.wait_for(
                topic_extractor.extract_topics(
                    file_path=file_path,
                    subject=subject,
                    user_id="default_user",
                ),
                timeout=22.0,
            )
        except Exception as e:
            print(f"[StudyAPI] Extraction note ({e}), extracting from document text...")
            sample = topic_extractor._fast_extract_pdf_text(file_path, max_pages=20) if file_path.lower().endswith(".pdf") else ""
            return topic_extractor._heuristic_fallback(subject, Path(file.filename).stem, sample)


    # Execute both in parallel
    _, extraction_result = await asyncio.gather(
        doc_processor.ingest_document(
            doc_id=study_id,
            file_path=file_path,
            file_name=file.filename,
            subject=subject,
            session_id=study_id,
        ),
        _safe_extract_topics(),
    )

    # Stage 2 & 3: Background Enrichment (async, non-blocking)
    asyncio.create_task(doc_processor.run_background_enrichment(study_id))


    # Cache active study session & persist to isolated session database
    topics = extraction_result.get("topics", [])
    session_title = extraction_result.get("title", f"{subject} Study Session")
    session_payload = {
        "id": study_id,
        "subject": subject,
        "file_name": file.filename,
        "file_path": file_path,
        "topics": topics,
        "title": session_title,
        "thought_process": extraction_result.get("thought_process"),
    }
    _study_sessions[study_id] = session_payload

    # Persist topics into physical SQLite session DB and update registry
    session_manager.save_session_state(
        session_id=study_id,
        topics=topics,
        subject=subject,
        title=session_title,
    )

    return {
        "success": True,
        "study_id": study_id,
        "subject": subject,
        "file_name": file.filename,
        "title": session_payload["title"],
        "topics": topics,
        "thought_process": session_payload["thought_process"],
    }





# ─── 2. Get Topics for Session ──────────────────────────────────────────────────
@router.get("/session/{study_id}")
async def get_study_session(study_id: str):
    """Retrieve details and topics for an active study session."""
    session = _study_sessions.get(study_id)
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")
    return session


# ─── 3. Normal Mode: Core Idea ──────────────────────────────────────────────────
@router.post("/topic/core-idea")
async def get_topic_core_idea(body: CoreIdeaRequest):
    """Print the core idea of a topic for Normal Mode."""
    session = _study_sessions.get(body.session_id, {})
    context = doc_processor.get_document_text(body.session_id, max_chars=5000)
    if not context and session.get("file_path"):
        ext = Path(session["file_path"]).suffix.lower()
        if ext in {".txt", ".md", ".py", ".csv", ".json"}:
            try:
                with open(session["file_path"], "r", encoding="utf-8", errors="ignore") as f:
                    context = f.read(5000)
            except Exception:
                pass

    core_idea = await teaching_engine.get_core_idea(
        topic_title=body.topic_title,
        topic_summary=body.topic_summary or "",
        context=context,
    )

    return {
        "topic_id": body.topic_id,
        "topic_title": body.topic_title,
        "core_idea": core_idea,
    }


# ─── 4. Normal Mode: Interactive Doubt Resolution ──────────────────────────────
@router.post("/topic/doubt")
async def resolve_topic_doubt(body: DoubtRequest):
    """Resolve student doubts with source-tagged grounded chat."""
    context, _, _ = doc_processor.retrieve_context(
        doc_id=body.session_id,
        query=f"{body.topic_title} {body.question}",
        top_k=5,
    )

    answer = await teaching_engine.answer_doubt(
        topic_title=body.topic_title,
        question=body.question,
        context=context,
        history=body.history or [],
    )


    return {
        "topic_id": body.topic_id,
        "question": body.question,
        "answer": answer,
    }


# ─── 5. Teacher Mode: Progressive Teaching Stream ──────────────────────────────
@router.get("/topic/teach/stream")
async def stream_teacher_mode(
    session_id: str = Query(...),
    topic_id: str = Query(...),
    topic_title: str = Query(...),
):
    """
    SSE stream for Teacher Mode lesson delivery:
    Intro -> Simple Explanation -> Deep Breakdown -> Wrap-up
    """
    session = _study_sessions.get(session_id, {})
    context = doc_processor.get_document_text(session_id, max_chars=8000)
    if not context and session.get("file_path"):
        ext = Path(session["file_path"]).suffix.lower()
        if ext in {".txt", ".md", ".py", ".csv", ".json"}:
            try:
                with open(session["file_path"], "r", encoding="utf-8", errors="ignore") as f:
                    context = f.read(8000)
            except Exception:
                pass

    async def event_generator():
        try:
            async for token_text in teaching_engine.teach_topic_stream(
                topic_title=topic_title,
                context=context,
            ):
                yield f"data: {json.dumps({'type': 'token', 'data': token_text})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ─── 6. Teacher Mode: Comprehensive Mixed Examination ─────────────────────────
@router.post("/topic/exam")
async def generate_topic_exam(body: ExamRequest):
    """
    Generates a mixed exam with Written questions, MCQs, and Fill-in-the-blanks.
    """
    session = _study_sessions.get(body.session_id, {})
    context = doc_processor.get_document_text(body.session_id, max_chars=6000)
    if not context and session.get("file_path"):
        ext = Path(session["file_path"]).suffix.lower()
        if ext in {".txt", ".md", ".py", ".csv", ".json"}:
            try:
                with open(session["file_path"], "r", encoding="utf-8", errors="ignore") as f:
                    context = f.read(6000)
            except Exception:
                pass

    exam = await exam_generator.generate_exam(
        topic_title=body.topic_title,
        context=context,
    )

    return exam


# ─── 7. Teacher Mode: Exam Evaluation & Results ────────────────────────────────
@router.post("/topic/evaluate")
async def evaluate_topic_exam(body: EvaluateRequest):
    """
    Evaluates student answers for written, MCQ, and fill-in-the-blank questions.
    Returns calculated score, mastery grade, and in-depth explanations per question.
    """
    evaluation = await exam_generator.evaluate_exam(
        questions=body.questions,
        student_answers=body.answers,
    )
    return evaluation
