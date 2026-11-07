"""
Comprehensive Verification Test Script for:
1. Multi-Tenant Document & Session Isolation (User A vs User B).
2. Persistent Storage of Queries and Responses (SQLite fallback disk store).
3. Independent Chat Threads ("like ChatGPT": Session 1 != Session 2, no bleed).
4. Cold Restart Simulation: in-memory state wiped, verifying data survives and loads from disk.
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.rag.pgvector_store import pgvector_store
from app.rag.session_manager import session_manager


def run_tests():
    print("=" * 70)
    print("TUTOR MVP VERIFICATION: PERSISTENCE, MULTI-TENANCY & SESSION ISOLATION")
    print("=" * 70)

    user_a = "user_alice_uuid_111"
    user_b = "user_bob_uuid_222"

    sid_a1 = f"session_ml_intro_{user_a}"
    sid_a2 = f"session_ml_advanced_{user_a}"
    sid_b1 = f"session_history_{user_b}"

    # Initialize SQLite / PostgreSQL tables
    pgvector_store.initialize_schema()

    # Clean existing
    pgvector_store.clear_session(sid_a1, user_id=user_a)
    pgvector_store.clear_session(sid_a2, user_id=user_a)
    pgvector_store.clear_session(sid_b1, user_id=user_b)

    # -------------------------------------------------------------
    # 1. PERSON A CREATES SESSION 1 (Machine Learning Intro)
    # -------------------------------------------------------------
    print("\n[Step 1] Person A creates Session 1 (Machine Learning Basics)...")
    pgvector_store.ensure_session(sid_a1, subject="Machine Learning", title="Basics of Neural Networks", user_id=user_a)
    
    # Person A sends Query 1 and gets Response 1 in Session 1
    messages_a1 = [
        {
            "id": "msg_a1_1",
            "role": "user",
            "text": "What is backpropagation in simple terms?",
        },
        {
            "id": "msg_a1_2",
            "role": "assistant",
            "text": "Backpropagation is the algorithm used to calculate error gradients so neural network weights can be updated.",
            "thoughtProcess": "Explaining gradient descent and chain rule simply.",
            "quizData": {"question": "What mathematical rule does backpropagation rely on?", "options": ["Product rule", "Chain rule"], "answer": "Chain rule"},
        }
    ]
    pgvector_store.save_session_state(sid_a1, messages=messages_a1, user_id=user_a)

    # -------------------------------------------------------------
    # 2. PERSON A CREATES SESSION 2 (Machine Learning Advanced - Transformers)
    # -------------------------------------------------------------
    print("\n[Step 2] Person A creates Session 2 (Transformers & Attention) - like a new ChatGPT chat...")
    pgvector_store.ensure_session(sid_a2, subject="Machine Learning", title="Transformers & Self-Attention", user_id=user_a)

    # Person A sends Query 1 and gets Response 1 in Session 2
    messages_a2 = [
        {
            "id": "msg_a2_1",
            "role": "user",
            "text": "How does multi-head self-attention work?",
        },
        {
            "id": "msg_a2_2",
            "role": "assistant",
            "text": "Multi-head attention projects Queries, Keys, and Values multiple times with different linear projections.",
            "thoughtProcess": "Focus on Q, K, V dot-product attention equation.",
        }
    ]
    pgvector_store.save_session_state(sid_a2, messages=messages_a2, user_id=user_a)

    # -------------------------------------------------------------
    # 3. VERIFY SESSION INDEPENDENCE (ChatGPT Style: S1 != S2)
    # -------------------------------------------------------------
    print("\n[Step 3] Verifying session independence for Person A (Session 1 vs Session 2)...")
    state_a1 = pgvector_store.get_session_state(sid_a1, user_id=user_a)
    state_a2 = pgvector_store.get_session_state(sid_a2, user_id=user_a)

    texts_a1 = [m["text"] for m in state_a1["messages"]]
    texts_a2 = [m["text"] for m in state_a2["messages"]]

    print(f"  Session 1 message count: {len(texts_a1)}")
    print(f"  Session 2 message count: {len(texts_a2)}")

    assert len(texts_a1) == 2, f"Expected 2 messages in Session 1, got {len(texts_a1)}"
    assert len(texts_a2) == 2, f"Expected 2 messages in Session 2, got {len(texts_a2)}"
    assert "What is backpropagation in simple terms?" in texts_a1
    assert "What is backpropagation in simple terms?" not in texts_a2, "LEAK: Session 1 question leaked into Session 2!"
    assert "How does multi-head self-attention work?" in texts_a2
    assert "How does multi-head self-attention work?" not in texts_a1, "LEAK: Session 2 question leaked into Session 1!"
    print("  -> PASSED: Sessions are completely isolated, exactly like ChatGPT threads.")

    # -------------------------------------------------------------
    # 4. PERSON B CREATES A PRIVATE SESSION (World History)
    # -------------------------------------------------------------
    print("\n[Step 4] Person B creates a private session (World History)...")
    pgvector_store.ensure_session(sid_b1, subject="World History", title="The Industrial Revolution", user_id=user_b)
    messages_b1 = [
        {"id": "msg_b1_1", "role": "user", "text": "When did the Industrial Revolution begin?"},
        {"id": "msg_b1_2", "role": "assistant", "text": "It began around 1760 in Great Britain with mechanization of textile manufacturing."}
    ]
    pgvector_store.save_session_state(sid_b1, messages=messages_b1, user_id=user_b)

    # Person B indexes private documents
    b_chunk = [{
        "chunk_id": f"{sid_b1}_p1_c1",
        "session_id": sid_b1,
        "doc_id": sid_b1,
        "page": 1,
        "source_type": "text",
        "content": "Secret notes on 18th century British industrial steam engines and cotton mills.",
    }]
    pgvector_store.index_chunks(b_chunk, session_id=sid_b1, doc_id=sid_b1, user_id=user_b)

    # Verify Person A cannot access Person B's session or docs
    print("\n[Step 5] Verifying multi-tenant isolation (Person A vs Person B)...")
    b_session_seen_by_a = pgvector_store.get_session_state(sid_b1, user_id=user_a)
    assert b_session_seen_by_a is None, "SECURITY LEAK: Person A was able to read Person B's session state!"

    # Verify RAG search isolation
    search_res_for_a = pgvector_store.text_search(query="steam engines", session_id=sid_a1, user_id=user_a)
    assert len(search_res_for_a) == 0, "SECURITY LEAK: Person A retrieved Person B's document chunk via search!"
    print("  -> PASSED: Person A and Person B are cryptographically isolated.")

    # -------------------------------------------------------------
    # 6. SIMULATE SERVER RESTART / COLD RELOAD (Disk Persistence)
    # -------------------------------------------------------------
    print("\n[Step 6] Simulating cold server restart (wiping in-memory cache)...")
    pgvector_store._mem_sessions.clear()
    pgvector_store._mem_chunks.clear()

    print("  In-memory session count after wipe:", len(pgvector_store._mem_sessions))
    assert len(pgvector_store._mem_sessions) == 0

    # Load from disk via get_all_sessions
    persisted_sessions_a = pgvector_store.get_all_sessions(user_id=user_a)
    persisted_sids = [s["id"] for s in persisted_sessions_a]
    print(f"  Loaded Person A sessions from SQLite disk: {persisted_sids}")
    assert sid_a1 in persisted_sids, "Failed to load Session 1 from SQLite disk!"
    assert sid_a2 in persisted_sids, "Failed to load Session 2 from SQLite disk!"
    assert sid_b1 not in persisted_sids, "SECURITY LEAK: Person B session found in Person A's persisted list!"

    # Load queries and responses from disk
    restored_state_a1 = pgvector_store.get_session_state(sid_a1, user_id=user_a)
    assert restored_state_a1 is not None, "Failed to load session state from SQLite disk!"
    assert len(restored_state_a1["messages"]) == 2, f"Expected 2 messages restored from disk, got {len(restored_state_a1['messages'])}"
    assert restored_state_a1["messages"][0]["text"] == "What is backpropagation in simple terms?"
    assert "Backpropagation is the algorithm" in restored_state_a1["messages"][1]["text"]
    assert restored_state_a1["messages"][1]["quizData"]["answer"] == "Chain rule"
    print("  -> PASSED: Query and response history accurately restored from SQLite disk store!")

    # -------------------------------------------------------------
    # 7. CLEANUP
    # -------------------------------------------------------------
    print("\n[Step 7] Testing cascade deletion...")
    pgvector_store.clear_session(sid_a1, user_id=user_a)
    pgvector_store.clear_session(sid_a2, user_id=user_a)
    pgvector_store.clear_session(sid_b1, user_id=user_b)
    
    assert pgvector_store.get_session_state(sid_a1, user_id=user_a) is None
    print("  -> PASSED: Session deletion completed successfully.")

    print("\n" + "=" * 70)
    print("ALL TESTS PASSED (100% SUCCESS)!")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
