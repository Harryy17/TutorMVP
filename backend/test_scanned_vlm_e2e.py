import asyncio
import os
import io
import pymupdf
from PIL import Image, ImageDraw, ImageFont
from app.rag.doc_processor import doc_processor
from app.rag.topic_extractor import topic_extractor
from app.rag.vlm_client import vlm_client

async def run_tests():
    print("=== Testing Indie Tutor VLM Scanned PDF & Image Pipeline ===")
    
    # 1. Test Gemini Key & VLM Configuration
    print("\n1. Checking VLM Configuration...")
    is_conf = vlm_client.is_configured()
    print("   VLM Configured:", is_conf)
    assert is_conf, "VLM Client is not configured!"

    # 2. Create a test raster image with academic text
    test_dir = os.path.join(os.path.dirname(__file__), "test_artifacts")
    os.makedirs(test_dir, exist_ok=True)
    img_path = os.path.join(test_dir, "test_scanned_notes.png")

    img = Image.new("RGB", (800, 600), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    text_content = (
        "CHAPTER 4: ELECTROMAGNETIC INDUCTION\n\n"
        "1. Faraday's Law of Induction:\n"
        "The induced electromotive force (EMF) in any closed circuit is equal to the negative of\n"
        "the time rate of change of magnetic flux through the circuit.\n"
        "Formula: EMF = -d(Phi_B)/dt\n\n"
        "2. Lenz's Law:\n"
        "The direction of the induced current is such that it opposes the change in magnetic flux\n"
        "that produced it, ensuring conservation of energy.\n\n"
        "3. Mutual and Self Inductance:\n"
        "Self-inductance L = (N * Phi) / I. Unit: Henry (H)."
    )
    draw.text((40, 40), text_content, fill=(0, 0, 0))
    img.save(img_path)
    print(f"\n2. Created sample image document: {img_path}")

    # 3. Test Image Ingestion in DocProcessor via VLM
    print("\n3. Testing Document Ingestion on Image...")
    img_doc = await doc_processor.ingest_document(
        doc_id="test_img_doc_1",
        file_path=img_path,
        file_name="test_scanned_notes.png",
        subject="Physics",
        session_id="test_session_img",
    )
    print(f"   Image Ingestion Result: Status={img_doc.status}, Text Chunks={img_doc.stats['text_chunks']}")
    assert img_doc.stats['text_chunks'] > 0, "No chunks extracted from image!"
    print(f"   Extracted chunk snippet: {img_doc.chunks[0].content[:150]}...")

    # 4. Create a pure raster (Scanned) PDF (contains NO digital text stream)
    pdf_path = os.path.join(test_dir, "test_scanned_document.pdf")
    doc_pdf = pymupdf.open()
    page = doc_pdf.new_page(width=800, height=600)
    
    # Render PIL image into byte stream and insert as pure image into PDF
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    page.insert_image(pymupdf.Rect(0, 0, 800, 600), stream=img_byte_arr.getvalue())
    doc_pdf.save(pdf_path)
    doc_pdf.close()
    print(f"\n4. Created pure scanned PDF (0 extractable digital text stream): {pdf_path}")

    # Verify PyPDF extracts 0 text
    import pypdf
    r = pypdf.PdfReader(pdf_path)
    extracted_pypdf = r.pages[0].extract_text()
    print(f"   Standard digital extract_text length: {len(extracted_pypdf.strip())} chars (Expected ~0 for scanned)")

    # 5. Test Scanned PDF Ingestion in DocProcessor via VLM
    print("\n5. Testing Document Ingestion on Scanned PDF...")
    pdf_doc = await doc_processor.ingest_document(
        doc_id="test_pdf_doc_1",
        file_path=pdf_path,
        file_name="test_scanned_document.pdf",
        subject="Physics",
        session_id="test_session_pdf",
    )
    print(f"   Scanned PDF Ingestion Result: Status={pdf_doc.status}, Text Chunks={pdf_doc.stats['text_chunks']}")
    assert pdf_doc.stats['text_chunks'] > 0, "No chunks extracted from scanned PDF!"
    print(f"   Extracted chunk snippet: {pdf_doc.chunks[0].content[:150]}...")

    # 6. Test RAG Context Retrieval on Scanned PDF
    print("\n6. Testing RAG Retrieval on Scanned PDF...")
    ctx, note, meta = doc_processor.retrieve_context(
        doc_id="test_pdf_doc_1",
        query="What is Faraday's Law and the formula?",
        top_k=3,
        session_id="test_session_pdf",
    )
    print(f"   Retrieved Context:\n{ctx[:250]}...")
    assert "Faraday" in ctx or "EMF" in ctx or "flux" in ctx.lower(), "Retrieved context does not contain Faraday's law!"

    # 7. Test Topic Extraction on Scanned PDF
    print("\n7. Testing Topic Extraction on Scanned PDF via VLM...")
    topics_res = await topic_extractor.extract_topics(
        file_path=pdf_path,
        subject="Electromagnetic Induction",
        user_id="test_user"
    )
    print(f"   Topic Extraction Result Title: {topics_res.get('title')}")
    print(f"   Extracted Topics Count: {len(topics_res.get('topics', []))}")
    for t in topics_res.get('topics', []):
        print(f"     - [{t.get('difficulty')}] {t.get('title')}: {t.get('summary')[:80]}...")

    assert len(topics_res.get('topics', [])) > 0, "No topics extracted from scanned PDF!"

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Scanned PDFs & Images are fully digitized with VLM!")

if __name__ == "__main__":
    asyncio.run(run_tests())
