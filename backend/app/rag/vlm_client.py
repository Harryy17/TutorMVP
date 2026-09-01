"""
Google Gemini Vision Language Model (VLM) Client.
Used for scanned documents, images (.png, .jpg, .webp), and image-based PDFs
to extract structured topics and key concepts in <5s without extracting raw images or tables.
"""
import os
import base64
import json
import httpx
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import dotenv_values


VLM_CASCADE_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.7-flash",
]



def _get_active_gemini_key() -> str:
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        vals = dotenv_values(env_path)
        key = vals.get("GEMINI_API_KEY", "")
        if key and key.strip() and key != "your_gemini_api_key_here":
            return key.strip()
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""


class GeminiVLMClient:
    """
    Vision-Language client using Google Gemini API.
    Supports multimodal inputs (image + prompt) for:
    1. Full OCR and academic text extraction
    2. Topic tree & curriculum extraction
    3. Diagram / figure factual captioning
    """

    def __init__(self):
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.timeout = 20.0

    @property
    def api_key(self) -> str:
        return _get_active_gemini_key()

    def is_configured(self) -> bool:
        key = self.api_key
        return bool(key and len(key.strip()) > 10 and key != "your_gemini_api_key_here")

    def render_pdf_page_to_image(self, file_path: str, page_idx: int = 0, dpi: int = 150) -> Optional[bytes]:
        """Renders a specific page of a PDF file to PNG image bytes using PyMuPDF."""
        try:
            import pymupdf
            doc = pymupdf.open(file_path)
            if 0 <= page_idx < len(doc):
                page = doc[page_idx]
                pix = page.get_pixmap(dpi=dpi)
                return pix.tobytes("png")
        except Exception as e:
            try:
                import fitz
                doc = fitz.open(file_path)
                if 0 <= page_idx < len(doc):
                    page = doc[page_idx]
                    pix = page.get_pixmap(dpi=dpi)
                    return pix.tobytes("png")
            except Exception as e2:
                print(f"[GeminiVLM] PDF render page {page_idx} error: {e2}")
        return None

    def get_pdf_page_count(self, file_path: str) -> int:
        """Returns total page count of a PDF file."""
        try:
            import pymupdf
            doc = pymupdf.open(file_path)
            return len(doc)
        except Exception:
            try:
                import fitz
                doc = fitz.open(file_path)
                return len(doc)
            except Exception:
                return 0

    async def extract_text_from_image(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        context_hint: str = "",
    ) -> str:
        """
        Extracts all readable text, formulas, equations, definitions, and structured notes
        from an image or scanned document page using Gemini VLM.
        """
        if not self.is_configured():
            return ""

        b64_data = base64.b64encode(image_bytes).decode("utf-8")

        prompt = (
            "You are an expert academic OCR and document digitization engine.\n"
            f"The subject/context of this study material is: '{context_hint or 'Academic Study Material'}'.\n\n"
            "MANDATORY INSTRUCTIONS:\n"
            "1. Extract ALL readable text, headings, subheadings, bullet points, explanations, and notes from this image verbatim.\n"
            "2. Preserve mathematical equations, formulas, theorems, and proofs accurately (using clean LaTeX or standard math notations).\n"
            "3. If diagrams, charts, or figures are present, include their labels and a concise factual summary in brackets [Figure: ...].\n"
            "4. Maintain proper paragraph hierarchy and reading sequence.\n"
            "5. Output ONLY the extracted text content. Do NOT include conversational commentary like 'Here is the text:' or markdown wrappers."
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": b64_data,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 4096,
            },
        }

        key = self.api_key
        for model_name in VLM_CASCADE_MODELS:
            url = f"{self.base_url}/models/{model_name}:generateContent?key={key}"
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    r = await client.post(url, json=payload)
                    if r.status_code == 200:
                        data = r.json()
                        text = (
                            data.get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [{}])[0]
                            .get("text", "")
                        )
                        if text and text.strip():
                            return text.strip()
                    elif r.status_code in (404, 429, 503):
                        print(f"[GeminiVLM] Model {model_name} returned status {r.status_code}, cascading...")
                        continue
            except Exception as e:
                print(f"[GeminiVLM] OCR error with model {model_name}: {e}")
                continue

        return ""

    async def analyze_scanned_image(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        subject_hint: str = "",
    ) -> Dict[str, Any]:
        """
        Analyze a scanned page or diagram image using Gemini VLM.
        Extracts structured topics, core concepts, and hierarchy.
        """
        if not self.is_configured():
            return self._offline_fallback(subject_hint)

        b64_data = base64.b64encode(image_bytes).decode("utf-8")

        prompt = (
            f"You are an expert academic curriculum parser. The user is studying '{subject_hint or 'the uploaded subject'}'.\n"
            "Analyze this scanned document/page image.\n"
            "MANDATORY INSTRUCTIONS:\n"
            "1. Extract 3 to 6 core academic topics and key concepts from this text in prerequisite order (Beginner -> Intermediate -> Advanced).\n"
            "2. Avoid generic titles like 'Introduction' or 'Overview'. Extract concrete, specific conceptual topics.\n"
            "3. Return a clean, strictly valid JSON response with this structure:\n"
            "{\n"
            '  "thought_process": "Brief explanation of topic prioritization.",\n'
            '  "title": "Main Subject or Chapter Title",\n'
            '  "topics": [\n'
            "    {\n"
            '      "id": "topic_1",\n'
            '      "title": "Topic Heading",\n'
            '      "summary": "Brief 1-2 sentence overview of this topic.",\n'
            '      "difficulty": "Beginner | Intermediate | Advanced",\n'
            '      "key_concepts": ["concept 1", "concept 2"],\n'
            '      "estimated_study_time": "10-15 mins"\n'
            "    }\n"
            "  ]\n"
            "}\n"
            "Return raw JSON only, no markdown backticks, no other text."
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": b64_data,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 2048,
            },
        }

        key = self.api_key
        for model_name in VLM_CASCADE_MODELS:
            url = f"{self.base_url}/models/{model_name}:generateContent?key={key}"
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    r = await client.post(url, json=payload)
                    if r.status_code == 200:
                        data = r.json()
                        text = (
                            data.get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [{}])[0]
                            .get("text", "")
                        )
                        cleaned = text.strip()
                        if cleaned.startswith("```"):
                            cleaned = cleaned.split("\n", 1)[1]
                            if cleaned.endswith("```"):
                                cleaned = cleaned.rsplit("\n", 1)[0]
                            if cleaned.startswith("json"):
                                cleaned = cleaned[4:].strip()

                        parsed = json.loads(cleaned)
                        if parsed and "topics" in parsed and len(parsed["topics"]) > 0:
                            for i, t in enumerate(parsed["topics"]):
                                if not t.get("id"):
                                    t["id"] = f"topic_{i+1}"
                            return parsed
                    elif r.status_code in (404, 429, 503):
                        continue
            except Exception as e:
                print(f"[GeminiVLM] analyze_scanned_image error with {model_name}: {e}")
                continue

        return self._offline_fallback(subject_hint)

    def _offline_fallback(self, subject: str) -> Dict[str, Any]:
        """Offline fallback if Gemini is unreachable."""
        return {
            "thought_process": f"Generated curriculum topics for {subject or 'Study Material'}.",
            "title": f"{subject or 'Study Material'} Overview",
            "topics": [
                {
                    "id": "topic_1",
                    "title": f"Core Foundations of {subject or 'Topic'}",
                    "summary": "Primary definitions, governing principles, and essential concepts.",
                    "difficulty": "Beginner",
                    "key_concepts": ["Core Definitions", "Primary Theorems", "Fundamental Rules"],
                    "estimated_study_time": "10-12 mins",
                },
                {
                    "id": "topic_2",
                    "title": f"Applied Methods & Mechanics",
                    "summary": "Step-by-step problem-solving methods and practical applications.",
                    "difficulty": "Intermediate",
                    "key_concepts": ["Methods", "Execution Steps", "Standard Problems"],
                    "estimated_study_time": "15-18 mins",
                },
                {
                    "id": "topic_3",
                    "title": f"Advanced Mastery & Examination Synthesis",
                    "summary": "Complex scenarios, edge cases, and exam-level problem breakdowns.",
                    "difficulty": "Advanced",
                    "key_concepts": ["Edge Cases", "Synthesis", "Exam Traps"],
                    "estimated_study_time": "15-20 mins",
                },
            ],
        }


# Singleton instance
vlm_client = GeminiVLMClient()
