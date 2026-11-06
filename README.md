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
