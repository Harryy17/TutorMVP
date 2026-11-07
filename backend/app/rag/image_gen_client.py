"""
OpenAI / Azure OpenAI DALL-E Image Generation Client.
Generates educational diagrams, schematics, and concept illustrations on demand,
downloads them locally to uploads/{session_id}/generated/ to prevent temporary link expiration,
and provides grounded /api/media/... image URLs.
"""
import os
import re
import uuid
from pathlib import Path
from typing import Dict, Any, Optional
import httpx
from dotenv import dotenv_values


def _get_active_env() -> Dict[str, str]:
    """Reads latest values from .env dynamically."""
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    vals = {}
    if env_path.exists():
        vals = dotenv_values(env_path)
    return {
        "AZURE_OPENAI_API_KEY": (vals.get("AZURE_OPENAI_API_KEY") or os.environ.get("AZURE_OPENAI_API_KEY") or "").strip(),
        "AZURE_OPENAI_ENDPOINT": (vals.get("AZURE_OPENAI_ENDPOINT") or os.environ.get("AZURE_OPENAI_ENDPOINT") or "").strip(),
        "AZURE_OPENAI_DALLE_DEPLOYMENT": (vals.get("AZURE_OPENAI_DALLE_DEPLOYMENT") or os.environ.get("AZURE_OPENAI_DALLE_DEPLOYMENT") or "").strip(),
        "OPENAI_API_KEY": (vals.get("OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY") or "").strip(),
        "OPENAI_BASE_URL": (vals.get("OPENAI_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").strip(),
    }


class OpenAIImageClient:
    def __init__(self):
        self.upload_root = Path(__file__).resolve().parent.parent.parent / "uploads"

    def is_configured(self) -> bool:
        env = _get_active_env()
        has_azure = bool(env["AZURE_OPENAI_API_KEY"] and env["AZURE_OPENAI_ENDPOINT"] and env["AZURE_OPENAI_DALLE_DEPLOYMENT"])
        has_openai = bool(env["OPENAI_API_KEY"])
        return has_azure or has_openai

    def craft_educational_prompt(self, topic: str, context_snippet: str = "") -> str:
        """Crafts a prompt tailored for clear, legible educational diagrams and technical schematics."""
        clean_topic = topic.strip()
        context_hint = f" depicting: {context_snippet[:150]}" if context_snippet else ""
        return (
            f"A clean, clear educational textbook diagram illustrating {clean_topic}{context_hint}. "
            "Professional educational schematic, minimalist modern infographic, white background, "
            "clean lines, high contrast, highly legible visual workflow, vector illustration style, 4k resolution."
        )

    async def generate_image(
        self,
        prompt: str,
        session_id: str = "default_session",
        size: str = "1024x1024",
        quality: str = "standard",
    ) -> Optional[Dict[str, Any]]:
        """
        Generates an image using Azure OpenAI DALL-E or standard OpenAI API,
        downloads the PNG to uploads/{session_id}/generated/, and returns the media URL.
        """
        env = _get_active_env()
        azure_key = env["AZURE_OPENAI_API_KEY"]
        azure_ep = env["AZURE_OPENAI_ENDPOINT"]
        azure_dep = env["AZURE_OPENAI_DALLE_DEPLOYMENT"] or "dall-e-3"
        openai_key = env["OPENAI_API_KEY"]
        openai_base = env["OPENAI_BASE_URL"]

        remote_url: Optional[str] = None
        revised_prompt: Optional[str] = None

        async with httpx.AsyncClient(timeout=60.0) as client:
            # 1. Try Azure OpenAI if configured
            if azure_key and azure_ep:
                base = azure_ep.strip().rstrip("/")
                for suffix in ["/openai/v1/responses", "/openai/v1/chat/completions", "/openai/v1", "/openai"]:
                    if base.endswith(suffix):
                        base = base[:-len(suffix)].rstrip("/")
                url = f"{base}/openai/deployments/{azure_dep}/images/generations?api-version=2024-02-01"
                headers = {
                    "api-key": azure_key,
                    "Content-Type": "application/json",
                }
                body = {
                    "prompt": prompt,
                    "n": 1,
                    "size": size,
                    "quality": quality,
                }
                try:
                    resp = await client.post(url, headers=headers, json=body)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("data") and len(data["data"]) > 0:
                            remote_url = data["data"][0].get("url")
                            revised_prompt = data["data"][0].get("revised_prompt")
                    else:
                        print(f"[ImageClient] Azure DALL-E note ({resp.status_code}): {resp.text[:200]}")
                except Exception as e:
                    print(f"[ImageClient] Azure DALL-E error: {e}")

            # 2. Try standard OpenAI if Azure didn't succeed and OpenAI key is present
            if not remote_url and openai_key:
                url = f"{openai_base.rstrip('/')}/images/generations"
                headers = {
                    "Authorization": f"Bearer {openai_key}",
                    "Content-Type": "application/json",
                }
                body = {
                    "model": "dall-e-3",
                    "prompt": prompt,
                    "n": 1,
                    "size": size,
                    "quality": quality,
                }
                try:
                    resp = await client.post(url, headers=headers, json=body)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("data") and len(data["data"]) > 0:
                            remote_url = data["data"][0].get("url")
                            revised_prompt = data["data"][0].get("revised_prompt")
                    else:
                        print(f"[ImageClient] OpenAI DALL-E note ({resp.status_code}): {resp.text[:200]}")
                except Exception as e:
                    print(f"[ImageClient] OpenAI DALL-E error: {e}")

            if not remote_url:
                print("[ImageClient] Could not generate image from either Azure or OpenAI.")
                return None

            # 3. Download image and persist locally to uploads/{session_id}/generated/
            try:
                safe_sid = re.sub(r"[^\w\-]", "_", session_id)
                gen_dir = self.upload_root / safe_sid / "generated"
                gen_dir.mkdir(parents=True, exist_ok=True)

                filename = f"dalle_{uuid.uuid4().hex[:8]}.png"
                dest_path = gen_dir / filename

                img_resp = await client.get(remote_url)
                if img_resp.status_code == 200:
                    dest_path.write_bytes(img_resp.content)
                    local_media_url = f"/api/media/{safe_sid}/figure/{filename}"
                    return {
                        "url": local_media_url,
                        "remote_url": remote_url,
                        "file_name": filename,
                        "revised_prompt": revised_prompt or prompt,
                    }
            except Exception as dl_err:
                print(f"[ImageClient] Download note: {dl_err}. Falling back to remote URL.")

            # Fallback to direct remote URL if download fails
            return {
                "url": remote_url,
                "remote_url": remote_url,
                "file_name": "remote_image",
                "revised_prompt": revised_prompt or prompt,
            }


image_client = OpenAIImageClient()

