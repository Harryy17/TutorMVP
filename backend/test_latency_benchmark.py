import sys
import time
import asyncio
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.rag.decision_agent import decision_agent
from app.rag.query_analyzer import query_analyzer

async def benchmark():
    print("=" * 60)
    print("RUNNING END-TO-END CHATBOT LATENCY BENCHMARK")
    print("=" * 60)

    test_queries = [
        "What is machine learning in simple terms?",
        "Compare CNN vs Transformer architecture",
    ]

    for q in test_queries:
        print(f"\nEvaluating Query: '{q}'")
        t_start = time.time()

        # Step 1: Query analysis
        t0 = time.time()
        analysis = await query_analyzer.analyze(message=q, current_subject="Machine Learning")
        t_plan = time.time() - t0
        print(f"  [1] Query Analysis Time: {round(t_plan * 1000, 2)} ms (Intent: {analysis.get('intent')})")

        # Step 2: Decision Agent + Visual Spec synthesis
        t1 = time.time()
        res = await decision_agent.analyze_and_respond(
            message=q,
            current_subject="Machine Learning",
            query_analysis=analysis,
        )
        t_exec = time.time() - t1
        has_visual = bool(res.get("visual_spec"))
        visual_type = res.get("visual_spec", {}).get("visual_type") if has_visual else None
        print(f"  [2] Execution & Visual Engine Time: {round(t_exec, 2)} s (Visual Generated: {has_visual}, Type: {visual_type})")

        t_total = time.time() - t_start
        print(f"  ==> TOTAL END-TO-END TIME: {round(t_total, 2)} s")

    print("\n" + "=" * 60)
    print("BENCHMARK COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(benchmark())

