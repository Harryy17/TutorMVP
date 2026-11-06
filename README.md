# 🎓 DeepTutor — AI GraphRAG Learning Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_Store-orange.svg?style=flat)](https://www.trychroma.com/)
[![Netlify Ready](https://img.shields.io/badge/Netlify-Ready-00C7B7.svg?style=flat&logo=netlify)](https://www.netlify.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **DeepTutor** is a privacy-focused, open-source AI learning platform powered by a hybrid **GraphRAG architecture** — combining Dense Vector Search, Sparse BM25, and Knowledge Graph Subgraphs to answer questions **strictly from your uploaded study documents**. No hallucinations from the open web. No data leaving your machine unless you choose to.

---

## 📖 Table of Contents

- [Why DeepTutor?](#-why-deeptutor)
- [Key Features](#-key-features)
- [Architecture](#️-architecture)
- [Tech Stack](#️-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
- [Configuration](#️-configuration)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [RAG Evaluation](#-rag-evaluation)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#️-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgements](#-acknowledgements)

---

## 💡 Why DeepTutor?

Most AI study tools send your notes to a cloud API and answer from whatever the model "remembers." DeepTutor does the opposite:

- 🔒 **Privacy-first** — runs entirely on your machine with Ollama (optional cloud mode via NVIDIA NIM).
- 📚 **Grounded answers** — every response is traced to a retrieved chunk and a graph context; the UI shows you *where* it came from.
- 🕸️ **Graph-aware retrieval** — entities and relationships are extracted from your documents to answer multi-hop questions that flat vector search misses.
- 🎯 **Built for learning, not just chatting** — quizzes, flashcards, study plans, and XP tracking all draw from the same document index.

---

## ✨ Key Features

| Feature | Description |
|:--------|:------------|
| 🧠 **Hybrid GraphRAG Chat** | Dense + BM25 hybrid search, Reciprocal Rank Fusion, and Knowledge Graph context injection |
| 📑 **Multi-Format Ingestion** | PDF, PNG, JPG, WEBP, DOCX, CSV, XLSX, PPTX, HTML, TXT, MD |
| 🔍 **Advanced Retrieval** | HyDE, Query Expansion, Contextual Compression, Cross-encoder Reranking |
| 📊 **Knowledge Graph Visualizer** | Interactive `d3-force` entity/relationship graph |
| 🎮 **AI Quiz Engine** | Gamified multiple-choice quizzes generated directly from your documents |
| 🎴 **3D Flashcards** | Flippable cards with keyboard navigation and Text-to-Speech |
| 📅 **Study Plan Generator** | Day-by-day study roadmap with progress tracking |
| 🏆 **Leaderboard & Progress** | XP system, badges, and accuracy tracking across all quiz attempts |
| 🧪 **RAG Evaluation Suite** | DeepEval + Ragas benchmarks — faithfulness, precision, latency |

---

## 🏗️ Architecture

```mermaid
flowchart TD
    User([User / Browser]) <--> Frontend["React 19 + Vite + TypeScript"]
    Frontend <--> API["FastAPI Backend"]

    subgraph Ingestion["📥 Document Ingestion"]
        direction TB
        Upload[File Upload] --> Router{File Router}
        Router -->|PDF| Docling["IBM Docling / pypdfium2"]
        Router -->|Image| OCR["EasyOCR / Tesseract"]
        Router -->|Office| DocxParser["python-docx / openpyxl"]
        Docling --> Chunker[Semantic Chunker]
        OCR --> Chunker
        DocxParser --> Chunker
    end

    subgraph Engine["🔎 GraphRAG Engine"]
        direction TB
        Chunker --> Chroma[(ChromaDB)]
        Chunker --> Graph[(NetworkX Graph)]
        API --> QueryExpander[Query Expander]
        QueryExpander --> HyDE[HyDE Engine]
        HyDE --> Dense[Dense Vector Search]
        HyDE --> Sparse[BM25 Search]
        Dense --> RRF[RRF Fusion + Reranker]
        Sparse --> RRF
        RRF --> GraphCtx[Graph Subgraph Context]
        GraphCtx --> LLM["LLM — Ollama / NVIDIA NIM"]
    end

    LLM --> API
    Chroma -.-> Dense
    Graph -.-> GraphCtx
🛠️ Tech Stack
Layer	Technology
Frontend	React 19, TypeScript, Vite, Framer Motion, Zustand, TanStack Query
Styling	Vanilla CSS + Tailwind utility classes
Backend	FastAPI, Python 3.13, Uvicorn, Pydantic v2
Database	SQLAlchemy + SQLite
Vector Store	ChromaDB
Knowledge Graph	NetworkX
LLM / Embeddings	Ollama (local) — or NVIDIA NIM API (cloud)
Document Parsing	IBM Docling, pypdfium2, pdfplumber, python-docx, openpyxl
Evaluation	DeepEval, Ragas
Deployment	Netlify (frontend) + Render (backend)
📋 Prerequisites
Requirement	Version	Notes
Python	3.10+ (3.13 recommended)	Required for backend
Node.js	18+	Required for frontend
npm	9+	Ships with Node.js
Ollama	Latest	Required for local inference (default)
CUDA	Optional	Speeds up OCR and PDF parsing on NVIDIA GPUs
Pull the default models before starting:

bash
ollama pull llama3.1
ollama pull nomic-embed-text
💡 No GPU or don't want to run Ollama? Use the NVIDIA NIM cloud API instead.

🚀 Quick Start
1. Clone the Repository
bash
git clone https://github.com/Harryy17/DeepTutor.git
cd DeepTutor
2. Backend Setup
bash
cd backend
Option A — Automatic (Windows only)

bat
.\start.bat
This creates the virtual environment, installs dependencies, and starts the server.

Option B — Manual (all platforms)

bash
# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn app.main:app --reload --port 8000
✅ API docs will be available at http://localhost:8000/docs

3. Frontend Setup
bash
cd frontend
npm install
npm run dev
✅ Open http://localhost:5173 in your browser.

⚙️ Configuration
Copy the example environment file into place from the repository root:

bash
cp backend/.env.example backend/.env
Then edit backend/.env:

env
# ── LLM: Local Ollama (default) ──────────────────────────
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3.1
OLLAMA_EMBED_MODEL=nomic-embed-text

# ── Security ─────────────────────────────────────────────
SECRET_KEY=your-secret-key-here

# ── Optional: NVIDIA NIM (cloud) ─────────────────────────
# NVIDIA_API_KEY=nvapi-xxxxxxxxxxxx
# NVIDIA_CHAT_MODEL=meta/llama-3.1-8b-instruct
# NVIDIA_EMBED_MODEL=nvidia/nv-embedqa-e5-v5
Variable	Required	Default	Description
OLLAMA_BASE_URL	✅	http://localhost:11434	Local Ollama server URL
OLLAMA_CHAT_MODEL	✅	llama3.1	Chat/completion model
OLLAMA_EMBED_MODEL	✅	nomic-embed-text	Embedding model
SECRET_KEY	✅	—	JWT signing key — change in production
NVIDIA_API_KEY	❌	—	Enables NVIDIA NIM cloud inference
VITE_API_BASE_URL	✅ (frontend)	http://localhost:8000/api	Backend base URL used by the client
🌐 Deployment
Frontend — Netlify (Free)
The netlify.toml is pre-configured. Steps:

Push your fork to GitHub.

Go to Netlify.com → New Site from Git → select the repo.

Set build settings:

Base directory: frontend

Build command: npm run build

Publish directory: frontend/dist

Add the environment variable:

VITE_API_BASE_URL = https://your-backend.onrender.com/api

Click Deploy Site.

Backend — Render (Free)
Go to Render.com → New Web Service → connect your repo.

Configure:

Build command: pip install -r backend/requirements.txt

Start command: cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT

Add environment variables: SECRET_KEY, and NVIDIA_API_KEY if you're using NVIDIA NIM.

⚠️ Note: Render's free tier spins down after 15 minutes of inactivity, causing a ~30s cold start on the next request.

Using NVIDIA NIM API (No Local Ollama Required)
Sign up for a free API key at build.nvidia.com.

Add it to backend/.env:

env
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxx
NVIDIA_CHAT_MODEL=meta/llama-3.1-8b-instruct
NVIDIA_EMBED_MODEL=nvidia/nv-embedqa-e5-v5
Restart the backend — DeepTutor will automatically prefer NIM when the key is present.

📁 Project Structure
text
DeepTutor/
├── backend/
│   ├── app/
│   │   ├── api/              # REST endpoints (chat, auth, quiz, flashcards, etc.)
│   │   ├── core/             # Config, database, models
│   │   └── rag/              # GraphRAG pipeline, vector store, graph store, LLM client
│   ├── requirements.txt
│   ├── start.bat             # Auto-install + start (Windows)
│   ├── evaluate_rag.py       # RAG benchmark suite
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/       # Layout, ChatMessage, GraphContextPanel, etc.
│   │   ├── pages/            # ChatPage, DashboardPage, QuizPage, etc.
│   │   ├── services/         # API client
│   │   └── stores/           # Zustand state (auth, chat)
│   ├── netlify.toml
│   └── package.json
├── chroma_data/              # ChromaDB persisted vectors (gitignored in production)
├── graph_data/               # NetworkX knowledge graphs
├── uploads/                  # User-uploaded documents
└── README.md
🔌 API Reference
Full interactive documentation is served at /docs (Swagger UI) and /redoc when the backend is running. The main route groups are:

Group	Base Path	Purpose
Auth	/api/auth	Register, login, JWT issuance
Documents	/api/documents	Upload, list, and delete study material
Chat	/api/chat	GraphRAG question answering with citations
Graph	/api/graph	Entity/relationship subgraph for visualizer
Quiz	/api/quiz	Generate and submit quizzes
Flashcards	/api/flashcards	Generate and review flashcard decks
Study Plan	/api/study-plan	Generate and track study roadmaps
Leaderboard	/api/leaderboard	XP, badges, and accuracy rankings
📊 RAG Evaluation
Run the built-in benchmark suite:

bash
cd backend
python evaluate_rag.py
Results are written to:

backend/rag_evaluation_report.md

backend/deepeval_ragas_evaluation.json

Tracked metrics:

Metric	What it measures
Context Precision @K	Relevance of retrieved chunks
Context Hit Rate	Whether the gold answer appears in top-K
Mean Reciprocal Rank (MRR)	Ranking quality of the first relevant hit
Faithfulness Score	Answer groundedness (Ragas)
Answer Relevancy	Answer-to-question alignment (Ragas)
P50 / P95 Retrieval Latency	Retrieval performance
Generation TPS	Tokens per second during generation
🧰 Troubleshooting
Problem	Fix
Connection refused on chat	Ensure Ollama is running: ollama serve
model not found	Run ollama pull llama3.1 and ollama pull nomic-embed-text
CORS errors from the frontend	Set VITE_API_BASE_URL correctly and restart the dev server
PDF parsing is slow	Enable GPU acceleration (CUDA) or install pypdfium2 wheels
First request after deploy hangs	Render free tier cold start — wait ~30s and retry
ChromaDB index seems stale	Delete chroma_data/ and re-upload your documents
🗺️ Roadmap
□ Streaming token-by-token responses in the chat UI
□ Multi-user workspaces and shared document collections
□ Mobile PWA with offline flashcard review
□ Spaced-repetition (SM-2) scheduling for flashcards
□ Export study plans and quiz results to PDF
□ Pluggable vector stores (Qdrant, Weaviate)
Have an idea? Open an issue — feature requests are welcome.

🤝 Contributing
Contributions make open source great — all skill levels are welcome.

Fork the repository.

Create a branch: git checkout -b feature/my-feature

Commit using Conventional Commits: git commit -m "feat: add my feature"

Push: git push origin feature/my-feature

Open a Pull Request describing the change and linking any related issue.

Please run the evaluation suite (python evaluate_rag.py) before submitting RAG-related changes, and attach the before/after metrics to your PR.

📜 License
Distributed under the MIT License. See the LICENSE file for details.

🙏 Acknowledgements
DeepTutor stands on the shoulders of excellent open-source work:

FastAPI · React · Vite

ChromaDB · NetworkX

IBM Docling · Ollama · NVIDIA NIM

DeepEval · Ragas

<div align="center">
Built with ❤️ by the DeepTutor Team
