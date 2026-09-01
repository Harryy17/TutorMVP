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
    # Startup: ensure upload folder exists
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    print(f"[START] {settings.APP_NAME} - Study Room Engine Ready")
    print(f"[LLM]   NVIDIA NIM: {settings.NVIDIA_CHAT_MODEL}")
    print(f"[VLM]   Google Gemini: {settings.GEMINI_MODEL}")
    yield
    print("[STOP] Shutting down...")


app = FastAPI(
    title="Indie Tutor — AI Study Room API",
    description="Interactive Study Room Backend with Gemini VLM & NVIDIA NIM",
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


@app.get("/")
async def root():
    return {
        "name": "Indie Tutor — AI Study Room",
        "status": "online",
        "study_api": "/api/study",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "Indie Tutor Study Room",
    }
