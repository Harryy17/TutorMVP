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

    subgraph Ingestion["Document Ingestion"]
        direction LR
        Upload[File Upload] --> Router{File Router}
        Router -->|PDF| Docling["IBM Docling / pypdfium2"]
        Router -->|Image| OCR["EasyOCR / Tesseract"]
        Router -->|Office| DocxParser["python-docx / openpyxl"]
        Docling --> Chunker[Semantic Chunker]
        OCR --> Chunker
        DocxParser --> Chunker
    end

    subgraph Storage["Storage"]
        direction TB
        Chroma[(ChromaDB)]
        Graph[(NetworkX Graph)]
    end

    subgraph Engine["GraphRAG Engine"]
        direction TB
        QueryExpander[Query Expander] --> HyDE[HyDE Engine]
        HyDE --> Dense[Dense Vector Search]
        HyDE --> Sparse[BM25 Search]
        Dense --> RRF[RRF Fusion + Reranker]
        Sparse --> RRF
        RRF --> GraphCtx[Graph Subgraph Context]
        GraphCtx --> LLM["LLM — Ollama / NVIDIA NIM"]
    end

    Chunker --> Chroma
    Chunker --> Graph
    API --> QueryExpander
    Chroma -.-> Dense
    Graph -.-> GraphCtx
    LLM --> API
