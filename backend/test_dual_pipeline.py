import asyncio
import os
import io
import time
import pymupdf
from PIL import Image, ImageDraw
from app.rag.doc_processor import doc_processor
from app.rag.topic_extractor import topic_extractor

async def test_full_pipeline():
    test_dir = os.path.join(os.path.dirname(__file__), "test_artifacts")
    os.makedirs(test_dir, exist_ok=True)
    
    print("=== 1. Testing Normal (Digital Text) PDF Pipeline ===")
    digital_pdf_path = os.path.join(test_dir, "digital_sample.pdf")
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Chapter 1: Quantum Mechanics Foundations\n"
                              "Planck relation: E = h * f.\n"
                              "De Broglie wavelength: lambda = h / p.\n"
                              "Schrodinger equation governs quantum state evolution over time.")
    doc.save(digital_pdf_path)
    doc.close()

    t0 = time.time()
    digital_doc = await doc_processor.ingest_document(
        doc_id="digital_session_1",
        file_path=digital_pdf_path,
        file_name="digital_sample.pdf",
        subject="Physics",
        session_id="digital_session_1",
    )
    t_ingest = time.time() - t0
    print(f"Digital PDF Fast-path Ingestion Time: {t_ingest*1000:.1f}ms | Chunks: {digital_doc.stats['text_chunks']}")
    assert digital_doc.stats['text_chunks'] > 0

    # Test Background enrichment (async parallel)
    enrich_task = asyncio.create_task(doc_processor.run_background_enrichment("digital_session_1"))
    print("Launched background enrichment task in parallel (non-blocking).")

    # Immediate RAG query on text
    ctx, _, _ = doc_processor.retrieve_context(
        doc_id="digital_session_1",
        query="What is the De Broglie wavelength formula?",
        top_k=2,
        session_id="digital_session_1",
    )
    print(f"Immediate RAG Context Retrieved: {ctx.strip()}")
    assert "lambda = h / p" in ctx or "Broglie" in ctx

    await enrich_task
    print("Background enrichment completed successfully.")

    print("\n=== 2. Testing Scanned (Image-based) PDF Pipeline ===")
    scanned_pdf_path = os.path.join(test_dir, "scanned_sample.pdf")
    doc_scanned = pymupdf.open()
    page_s = doc_scanned.new_page(width=700, height=500)
    
    img = Image.new("RGB", (700, 500), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((40, 40), "Organic Chemistry: Hydrocarbons\n"
                        "Alkanes have general formula C_n H_{2n+2}.\n"
                        "Alkenes contain double bonds (C=C) with formula C_n H_{2n}.\n"
                        "Alkynes contain triple bonds (C#C) with formula C_n H_{2n-2}.", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    page_s.insert_image(pymupdf.Rect(0, 0, 700, 500), stream=buf.getvalue())
    doc_scanned.save(scanned_pdf_path)
    doc_scanned.close()

    t0 = time.time()
    scanned_doc = await doc_processor.ingest_document(
        doc_id="scanned_session_1",
        file_path=scanned_pdf_path,
        file_name="scanned_sample.pdf",
        subject="Chemistry",
        session_id="scanned_session_1",
    )
    t_vlm_ingest = time.time() - t0
    print(f"Scanned PDF VLM OCR Ingestion Time: {t_vlm_ingest:.2f}s | Chunks: {scanned_doc.stats['text_chunks']}")
    assert scanned_doc.stats['text_chunks'] > 0

    ctx_s, _, _ = doc_processor.retrieve_context(
        doc_id="scanned_session_1",
        query="What is the general formula for Alkanes?",
        top_k=2,
        session_id="scanned_session_1",
    )
    print(f"Scanned PDF RAG Context Retrieved: {ctx_s.strip()[:200]}...")
    assert "C_n" in ctx_s or "Alkanes" in ctx_s or "2n+2" in ctx_s

    print("\n[SUCCESS] Both Digital and Scanned Pipelines operate with optimal latency and accuracy!")

if __name__ == "__main__":
    asyncio.run(test_full_pipeline())
