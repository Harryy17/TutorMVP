"""
Verification Test Script for Multi-Tenant Document & Session Isolation.
Simulates Person A (Machine Learning doc) and Person B (Finance doc) to verify:
1. Sessions are strictly partitioned by user_id in the database.
2. RAG retrieval (hybrid full-text + vector) for Person B NEVER retrieves Person A's document chunks.
3. Person B cannot access Person A's session state.
"""
import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.rag.pgvector_store import pgvector_store
from app.rag.doc_processor import doc_processor
from app.rag.session_manager import session_manager


def run_isolation_tests():
    print("=" * 60)
    print("Starting Multi-Tenant Document & Session Isolation Verification")
    print("=" * 60)

    user_a = "user_alice_ml_101"
    user_b = "user_bob_finance_202"

    sid_a = f"test_session_ml_{user_a}"
    sid_b = f"test_session_fin_{user_b}"

    # 1. Initialize schema
    pgvector_store.initialize_schema()

    # Clean up any leftover test data
    pgvector_store.clear_session(sid_a, user_id=user_a)
    pgvector_store.clear_session(sid_b, user_id=user_b)

    # 2. Person A creates a Machine Learning study session & indexes chunks
    print("\n[Step 1] Creating Person A's Machine Learning session and document...")
    session_manager.create_session(subject="Machine Learning", title="Deep Neural Networks 101", user_id=user_a)
    pgvector_store.ensure_session(sid_a, subject="Machine Learning", title="Deep Neural Networks 101", user_id=user_a)

    ml_chunks = [
        {
            "chunk_id": f"{sid_a}_p1_c1",
            "session_id": sid_a,
            "doc_id": sid_a,
            "page": 1,
            "source_type": "text",
            "content": "Backpropagation computes gradients of the loss function with respect to weights using the chain rule in deep artificial neural networks.",
        },
        {
            "chunk_id": f"{sid_a}_p1_c2",
            "session_id": sid_a,
            "doc_id": sid_a,
            "page": 1,
            "source_type": "text",
            "content": "Convolutional Neural Networks (CNNs) utilize spatial filter kernels and pooling layers to process computer vision feature maps.",
        },
    ]
    pgvector_store.index_chunks(ml_chunks, session_id=sid_a, doc_id=sid_a, user_id=user_a)

    # 3. Person B creates a Finance session & indexes chunks
    print("[Step 2] Creating Person B's Finance session and document...")
    session_manager.create_session(subject="Finance & Economics", title="Monetary Policy & Capital Markets", user_id=user_b)
    pgvector_store.ensure_session(sid_b, subject="Finance & Economics", title="Monetary Policy & Capital Markets", user_id=user_b)

    fin_chunks = [
        {
            "chunk_id": f"{sid_b}_p1_c1",
            "session_id": sid_b,
            "doc_id": sid_b,
            "page": 1,
            "source_type": "text",
            "content": "Central banks utilize benchmark interest rates and quantitative easing to regulate liquidity, inflation, and sovereign bond yields.",
        },
    ]
    pgvector_store.index_chunks(fin_chunks, session_id=sid_b, doc_id=sid_b, user_id=user_b)

    # 4. Verify Session List Partitioning
    print("\n[Step 3] Verifying session listing isolation:")
    sessions_a = session_manager.list_sessions(user_id=user_a)
    sessions_b = session_manager.list_sessions(user_id=user_b)

    sids_for_a = [s["session_id"] for s in sessions_a]
    sids_for_b = [s["session_id"] for s in sessions_b]

    print(f"  Person A sessions: {sids_for_a}")
    print(f"  Person B sessions: {sids_for_b}")

    assert sid_a in sids_for_a, "Assertion failed: Person A should see their own ML session"
    assert sid_b not in sids_for_a, "SECURITY LEAK: Person A can see Person B's finance session!"
    assert sid_b in sids_for_b, "Assertion failed: Person B should see their own Finance session"
    assert sid_a not in sids_for_b, "SECURITY LEAK: Person B can see Person A's ML session!"
    print("  -> PASSED: Session listing is 100% strictly partitioned.")

    # 5. Verify Cross-User Session State Access
    print("\n[Step 4] Verifying cross-user session state security:")
    b_tries_access_a = session_manager.get_session_state(sid_a, user_id=user_b)
    print(f"  Person B accessing Person A session -> returned: {b_tries_access_a}")
    if b_tries_access_a and b_tries_access_a.get("meta", {}).get("user_id"):
        assert b_tries_access_a["meta"]["user_id"] != user_a, "SECURITY LEAK: Person B accessed Person A's session!"

    # 6. Verify RAG Text Retrieval Isolation (Full-Text Search)
    print("\n[Step 5] Verifying RAG retrieval isolation for Person B querying Machine Learning concepts:")
    # Person B queries "backpropagation neural networks"
    b_search_results = pgvector_store.text_search(
        query="backpropagation neural networks",
        limit=10,
        user_id=user_b,
    )
    print(f"  Person B search results count for ML query: {len(b_search_results)}")
    for r in b_search_results:
        print(f"    Leaked chunk: {r.get('content')}")
    assert len(b_search_results) == 0, "SECURITY LEAK: Person B retrieved Person A's ML document chunks!"
    print("  -> PASSED: Person B retrieved 0 chunks from Person A's ML document.")

    # Person A queries "backpropagation neural networks"
    a_search_results = pgvector_store.text_search(
        query="backpropagation neural networks",
        limit=10,
        user_id=user_a,
    )
    print(f"  Person A search results count for ML query: {len(a_search_results)}")
    assert len(a_search_results) > 0, "Person A should successfully retrieve their own ML chunks"
    print("  -> PASSED: Person A successfully retrieved their own ML chunks.")

    # 7. Verify doc_processor retrieve_context isolation
    print("\n[Step 6] Verifying doc_processor context retrieval isolation:")
    context_b, _, _ = doc_processor.retrieve_context(
        doc_id=sid_a,
        query="Explain backpropagation and loss gradients",
        user_id=user_b,
    )
    print(f"  Context returned to Person B when querying Person A's doc_id: '{context_b}'")
    assert "backpropagation" not in context_b.lower(), "SECURITY LEAK: doc_processor leaked ML content to Person B!"
    print("  -> PASSED: doc_processor blocked Person B from accessing Person A's document.")

    # 8. Clean up test records
    print("\n[Step 7] Cleaning up test records...")
    pgvector_store.clear_session(sid_a, user_id=user_a)
    pgvector_store.clear_session(sid_b, user_id=user_b)
    print("  -> Cleanup complete.")

    print("\n" + "=" * 60)
    print("ALL MULTI-TENANT ISOLATION TESTS PASSED WITH 100% INTEGRITY!")
    print("=" * 60)


if __name__ == "__main__":
    run_isolation_tests()

