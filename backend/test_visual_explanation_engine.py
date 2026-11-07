"""
Unit and Integration Tests for Dynamic Visual Explanation Engine.
Tests:
1. All 9 visual types Pydantic validation.
2. should_generate_visual decision logic (triggers vs suppression).
3. Complex bounds checking, sanitization (HTML stripping), and dangling connection repair.
4. Malformed JSON handling (graceful degradation, zero crash).
5. Deterministic fallback generation.
6. Persistence of visual_spec into SQLite/PostgreSQL store and accurate restoration.
"""
import sys
import json
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.rag.visual_engine import (
    VisualExplanationEngine,
    VisualSpecification,
    VisualType,
    VisualNode,
    VisualConnection,
    ComparisonDimension,
    MathIllustrationData,
    MathVariable,
    TimelineItem,
    visual_engine,
)
from app.rag.pgvector_store import pgvector_store


def test_visual_type_schemas():
    print("[Test 1] Testing Pydantic validation for all 9 visual types...")

    # 1. Process
    process_spec = VisualSpecification(
        visual_required=True,
        visual_type=VisualType.PROCESS,
        title="Neural Network Forward Pass",
        description="Linear projection and non-linear activation flow.",
        nodes=[
            VisualNode(id="n1", label="Input Layer", description="Raw features vector x", status="input"),
            VisualNode(id="n2", label="Hidden Layer", description="Linear transform Wx + b", status="process"),
            VisualNode(id="n3", label="Output Layer", description="Softmax probabilities", status="output"),
        ],
        connections=[
            VisualConnection(from_node="n1", to_node="n2", label="feeds into"),
            VisualConnection(from_node="n2", to_node="n3", label="activates"),
        ]
    )
    assert process_spec.visual_type == VisualType.PROCESS
    assert len(process_spec.nodes) == 3
    print("  -> Process diagram schema: VALID")

    # 2. Step-by-Step
    step_spec = VisualSpecification(
        visual_required=True,
        visual_type=VisualType.STEP_BY_STEP,
        title="Gradient Descent Optimization Steps",
        description="Iterative optimization method for parameter tuning.",
        nodes=[
            VisualNode(id="s1", label="Initialize Weights", description="Sample weights from Gaussian prior"),
            VisualNode(id="s2", label="Compute Loss Gradient", description="Evaluate partial derivatives via backpropagation"),
            VisualNode(id="s3", label="Update Parameters", description="Subtract learning rate * gradient"),
        ]
    )
    assert step_spec.visual_type == VisualType.STEP_BY_STEP
    print("  -> Step-by-Step schema: VALID")

    # 3. Concept Map
    cmap_spec = VisualSpecification(
        visual_required=True,
        visual_type=VisualType.CONCEPT_MAP,
        title="Transformer Architecture Concept Map",
        description="Interconnected relational map of self-attention mechanisms.",
        nodes=[
            VisualNode(id="core", label="Self-Attention", description="Core routing mechanism"),
            VisualNode(id="qkv", label="Queries, Keys, Values", description="Linear projection triplet"),
            VisualNode(id="mha", label="Multi-Head Attention", description="Parallel subspace projections"),
        ],
        connections=[
            VisualConnection(from_node="core", to_node="qkv", label="computes"),
            VisualConnection(from_node="core", to_node="mha", label="scaled to"),
        ]
    )
    assert cmap_spec.visual_type == VisualType.CONCEPT_MAP
    print("  -> Concept Map schema: VALID")

    # 4. Hierarchy
    hier_spec = VisualSpecification(
        visual_required=True,
        visual_type=VisualType.HIERARCHY,
        title="Machine Learning Taxonomical Hierarchy",
        description="Categorization of learning paradigms.",
        nodes=[
            VisualNode(id="h1", label="Machine Learning", level=0),
            VisualNode(id="h2", label="Supervised Learning", level=1),
            VisualNode(id="h3", label="Unsupervised Learning", level=1),
            VisualNode(id="h4", label="Classification", level=2),
        ],
        connections=[
            VisualConnection(from_node="h1", to_node="h2"),
            VisualConnection(from_node="h1", to_node="h3"),
            VisualConnection(from_node="h2", to_node="h4"),
        ]
    )
    assert hier_spec.visual_type == VisualType.HIERARCHY
    print("  -> Hierarchy diagram schema: VALID")

    # 5. Comparison
    comp_spec = VisualSpecification(
        visual_required=True,
        visual_type=VisualType.COMPARISON,
        title="CNN vs Vision Transformer (ViT)",
        description="Architectural tradeoffs in computer vision.",
        comparison_data=[
            ComparisonDimension(
                dimension="Inductive Bias",
                concept_a_value="Strong translation equivariance via local kernels",
                concept_b_value="Minimal inductive bias, relies on large-scale pre-training"
            ),
            ComparisonDimension(
                dimension="Receptive Field",
                concept_a_value="Grows gradually with network depth",
                concept_b_value="Global attention across all patches from layer 1"
            )
        ]
    )
    assert comp_spec.visual_type == VisualType.COMPARISON
    assert len(comp_spec.comparison_data) == 2
    print("  -> Comparison diagram schema: VALID")

    # 6. Architecture
    arch_spec = VisualSpecification(
        visual_required=True,
        visual_type=VisualType.ARCHITECTURE,
        title="RAG Educational Platform Architecture",
        description="End-to-end multi-tier cognitive retrieval architecture.",
        nodes=[
            VisualNode(id="client", label="React / Tailwind UI", category="Client Layer"),
            VisualNode(id="api", label="FastAPI Gateway", category="API Gateway"),
            VisualNode(id="rag", label="PgVector + FTS5 Retrieval", category="Storage Tier"),
        ],
        connections=[
            VisualConnection(from_node="client", to_node="api", label="HTTPS / REST"),
            VisualConnection(from_node="api", to_node="rag", label="Hybrid Search"),
        ]
    )
    assert arch_spec.visual_type == VisualType.ARCHITECTURE
    print("  -> Architecture diagram schema: VALID")

    # 7. Mathematical
    math_spec = VisualSpecification(
        visual_required=True,
        visual_type=VisualType.MATHEMATICAL,
        title="Sigmoid Activation Function Deconstruction",
        description="Logistic sigmoid activation formulation.",
        math_data=MathIllustrationData(
            primary_formula="$$ \\sigma(z) = \\frac{1}{1 + e^{-z}} $$",
            intuition="Compresses real numbers into a probability bounded between 0 and 1.",
            variables=[
                MathVariable(symbol="z", name="Logit", description="Linear pre-activation w*x + b"),
                MathVariable(symbol="e", name="Euler's Constant", description="Base of natural logarithms"),
            ]
        )
    )
    assert math_spec.visual_type == VisualType.MATHEMATICAL
    assert math_spec.math_data.variables[0].symbol == "z"
    print("  -> Mathematical illustration schema: VALID")

    # 8. Timeline
    time_spec = VisualSpecification(
        visual_required=True,
        visual_type=VisualType.TIMELINE,
        title="Evolution of Modern Language Models",
        description="Milestone development from Word2Vec to Reasoning Models.",
        timeline_data=[
            TimelineItem(time_period="2013", title="Word2Vec", summary="Distributed dense vector word representations"),
            TimelineItem(time_period="2017", title="Transformer Architecture", summary="Attention is all you need paper published"),
            TimelineItem(time_period="2020", title="GPT-3", summary="Few-shot in-context learning emerged at scale"),
        ]
    )
    assert time_spec.visual_type == VisualType.TIMELINE
    print("  -> Timeline schema: VALID")

    # 9. Scientific
    sci_spec = VisualSpecification(
        visual_required=True,
        visual_type=VisualType.SCIENTIFIC,
        title="Light Reactions of Photosynthesis",
        description="Photochemical energy transduction in the thylakoid membrane.",
        nodes=[
            VisualNode(id="in1", label="Photons & H2O", status="input", category="Inflow"),
            VisualNode(id="core", label="Photosystem II & Cytochrome b6f", status="process", category="Reaction"),
            VisualNode(id="out1", label="ATP, NADPH & O2", status="output", category="Outflow"),
        ],
        connections=[
            VisualConnection(from_node="in1", to_node="core", label="photo-excitation"),
            VisualConnection(from_node="core", to_node="out1", label="photophosphorylation"),
        ]
    )
    assert sci_spec.visual_type == VisualType.SCIENTIFIC
    print("  -> Scientific illustration schema: VALID")
    print("  ==> All 9 visual types verified successfully!")


def test_visual_decision_logic():
    print("\n[Test 2] Testing visual trigger & suppression decision logic...")

    # Should NOT trigger for trivial greetings
    assert not visual_engine.should_generate_visual("Hello!"), "Failed: Trivial greeting should not trigger visual"
    assert not visual_engine.should_generate_visual("Hi there"), "Failed: Hi should not trigger visual"
    assert not visual_engine.should_generate_visual("Thanks"), "Failed: Thanks should not trigger visual"

    # Should NOT trigger for length constraints (one word, one sentence)
    assert not visual_engine.should_generate_visual(
        "What is an LLM?",
        query_analysis={"length_constraint": "one_word"}
    ), "Failed: one_word constraint must suppress visuals"

    assert not visual_engine.should_generate_visual(
        "What is an LLM?",
        query_analysis={"suppress_scaffolding": True}
    ), "Failed: suppress_scaffolding must suppress visuals"

    # SHOULD trigger for explicit visual requests
    assert visual_engine.should_generate_visual("Show me a diagram of the transformer model")
    assert visual_engine.should_generate_visual("Can you visualize how backpropagation works step by step?")
    assert visual_engine.should_generate_visual("Compare CNN vs Vision Transformer")
    assert visual_engine.should_generate_visual("Explain the architecture of a web application")
    assert visual_engine.should_generate_visual("What is the timeline of the French Revolution?")

    # SHOULD trigger when planner recommends diagram
    assert visual_engine.should_generate_visual(
        "Explain attention",
        query_analysis={"visual_modality": "generative_diagram"}
    )
    print("  -> Decision logic successfully filters and selects appropriate visual triggers!")


def test_bounds_sanitization_and_repair():
    print("\n[Test 3] Testing bounds checking, HTML sanitization, and dangling connection repair...")

    # HTML script tag in label should be sanitized
    node = VisualNode(id="node_safe", label="<b>Sanitized</b><script>alert(1)</script> Label")
    assert "<script>" not in node.label
    assert "Sanitized" in node.label

    # Dangling connection to non-existent node must be automatically dropped by model_validator
    spec = VisualSpecification(
        visual_required=True,
        visual_type=VisualType.PROCESS,
        title="Dangling Connection Test",
        description="Test repair of dangling node references.",
        nodes=[
            VisualNode(id="valid_1", label="Valid 1"),
            VisualNode(id="valid_2", label="Valid 2"),
        ],
        connections=[
            VisualConnection(from_node="valid_1", to_node="valid_2"),
            VisualConnection(from_node="valid_1", to_node="non_existent_ghost_node"),  # Dangling!
        ]
    )
    assert len(spec.connections) == 1, f"Expected 1 valid connection, got {len(spec.connections)}"
    assert spec.connections[0].to_node == "valid_2"
    print("  -> Dangling connection successfully repaired and purged!")


def test_malformed_json_resilience():
    print("\n[Test 4] Testing resilience against malformed / corrupted LLM outputs...")

    # Complete garbage text
    parsed = visual_engine._parse_and_validate("This is not JSON at all!", VisualType.PROCESS, "Fallback Title")
    assert parsed is None, "Malformed string should return None safely"

    # Missing required fields
    parsed_bad = visual_engine._parse_and_validate('{"random_field": 123}', VisualType.PROCESS, "Fallback Title")
    assert parsed_bad is not None  # Auto-repaired with fallback title, description, and visual_type
    assert parsed_bad.visual_type == VisualType.PROCESS

    # Deterministic fallback builder
    fallback = visual_engine._build_deterministic_fallback(
        query="Backpropagation",
        reply_text="Step 1: Forward pass computes loss.\nStep 2: Backward pass computes gradients.\nStep 3: Optimizer updates weights.",
        visual_type=VisualType.PROCESS
    )
    assert fallback is not None
    assert fallback.visual_type == VisualType.PROCESS
    assert len(fallback.nodes) >= 3
    print("  -> Malformed JSON defensively handled with zero crash!")


def test_sqlite_persistence():
    print("\n[Test 5] Testing SQLite persistence of visual_spec in session messages...")

    pgvector_store.initialize_schema()
    test_sid = "test_visual_session_001"
    user_id = "user_visual_tester"

    pgvector_store.clear_session(test_sid, user_id=user_id)

    # Save a message containing visualSpec
    test_spec = {
        "visual_required": True,
        "visual_type": "architecture",
        "title": "Three-Tier Architecture",
        "description": "Client, Gateway, and Storage tiers.",
        "nodes": [
            {"id": "c1", "label": "Client UI", "category": "Frontend"},
            {"id": "c2", "label": "API Server", "category": "Backend"},
        ]
    }
    messages = [
        {"id": "msg_u1", "role": "user", "text": "Show me the system architecture"},
        {
            "id": "msg_b1",
            "role": "assistant",
            "text": "Here is the 3-tier system architecture breakdown.",
            "visualSpec": test_spec,
        }
    ]

    pgvector_store.save_session_state(test_sid, messages=messages, user_id=user_id)

    # Wipe in-memory caches to simulate server restart
    pgvector_store._mem_sessions.clear()

    # Load from disk
    restored = pgvector_store.get_session_state(test_sid, user_id=user_id)
    assert restored is not None
    bot_msg = restored["messages"][1]
    assert bot_msg["visualSpec"] is not None
    assert bot_msg["visualSpec"]["visual_type"] == "architecture"
    assert bot_msg["visualSpec"]["title"] == "Three-Tier Architecture"
    print("  -> Visual specification survived cold reload from SQLite disk store!")

    # Cleanup
    pgvector_store.clear_session(test_sid, user_id=user_id)
    print("  -> Cleanup complete.")


def run_all_tests():
    print("=" * 65)
    print("RUNNING DYNAMIC VISUAL EXPLANATION ENGINE VERIFICATION SUITE")
    print("=" * 65)
    test_visual_type_schemas()
    test_visual_decision_logic()
    test_bounds_sanitization_and_repair()
    test_malformed_json_resilience()
    test_sqlite_persistence()
    print("\n" + "=" * 65)
    print("ALL VISUAL ENGINE VERIFICATION TESTS PASSED (100% SUCCESS)!")
    print("=" * 65)


if __name__ == "__main__":
    run_all_tests()
