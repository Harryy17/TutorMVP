"""
FastAPI Backend — Dedicated AI Study Room Server.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pathlib import Path
from app.core.config import get_settings
from app.api import study

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure upload & data folders exist
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    print(f"[START] {settings.APP_NAME} - Study Room Engine Ready")
    if settings.AZURE_OPENAI_ENDPOINT and settings.AZURE_OPENAI_API_KEY:
        print(f"[LLM & VLM] Model: {settings.AZURE_OPENAI_DEPLOYMENT_NAME} (Azure OpenAI: {settings.AZURE_OPENAI_ENDPOINT})")
    elif settings.OPENAI_API_KEY:
        print(f"[LLM & VLM] Model: {settings.OPENAI_MODEL} (OpenAI)")
    else:
        print(f"[LLM & VLM] Model: {settings.AZURE_OPENAI_DEPLOYMENT_NAME} (Offline Fallback)")
    print(f"[S3]    AWS Cloud Storage: {settings.AWS_S3_BUCKET_NAME} ({settings.AWS_REGION})")

    # PostgreSQL + pgvector Database
    try:
        from app.rag.pgvector_store import pgvector_store
        if pgvector_store.is_configured():
            if pgvector_store.initialize_schema():
                print(f"[DB]    PostgreSQL + pgvector: Connected & tables ready")
            else:
                print(f"[DB]    PostgreSQL: Connection attempted")
        else:
            print(f"[DB]    pgvector_store active (set POSTGRES_URL to sync directly with Supabase)")
    except Exception as db_err:
        print(f"[DB]    PostgreSQL check note: {db_err}")

    yield
    print("[STOP] Shutting down...")


app = FastAPI(
    title="Indie Tutor — AI Study Room API",
    description="Interactive Study Room Backend powered by gpt 6.0 sol with Azure OpenAI & pgvector",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the Study router
app.include_router(study.router, prefix="/api")


@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {
        "name": "Indie Tutor — AI Study Room",
        "status": "online",
        "study_api": "/api/study",
        "docs": "/docs",
    }


@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health():
    return {
        "status": "ok",
        "service": "Indie Tutor Study Room",
    }


@app.post("/api/export/notes-md")
async def export_notes_md(body: study.ExportNotesRequest):
    return await study.export_notes_markdown(body)


@app.get("/api/media/{session_id}/figure/{file_name}")
async def get_root_figure_image(session_id: str, file_name: str):
    return await study.get_figure_image(session_id, file_name)


