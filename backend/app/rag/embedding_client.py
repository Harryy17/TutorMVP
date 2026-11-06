"""
Embeddings Client supporting Azure OpenAI, OpenAI, and local deterministic fallback.
Outputs 1536-dimensional normalized vectors compatible with pgvector.
"""
import os
import math
import hashlib
import httpx
from pathlib import Path
from typing import List, Optional, Dict
from dotenv import dotenv_values


def _get_active_env() -> Dict[str, str]:
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    vals = {}
    if env_path.exists():
        vals = dotenv_values(env_path)
    return {
        "AZURE_OPENAI_API_KEY": (vals.get("AZURE_OPENAI_API_KEY") or os.environ.get("AZURE_OPENAI_API_KEY") or "").strip(),
        "AZURE_OPENAI_ENDPOINT": (vals.get("AZURE_OPENAI_ENDPOINT") or os.environ.get("AZURE_OPENAI_ENDPOINT") or "").strip(),
        "AZURE_OPENAI_EMBEDDING_DEPLOYMENT": (
            vals.get("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")
            or os.environ.get("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")
            or "text-embedding-3-small"
        ).strip(),
        "AZURE_OPENAI_API_VERSION": (vals.get("AZURE_OPENAI_API_VERSION") or os.environ.get("AZURE_OPENAI_API_VERSION") or "2024-02-15-preview").strip(),
        "OPENAI_API_KEY": (vals.get("OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY") or "").strip(),
        "OPENAI_BASE_URL": (vals.get("OPENAI_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").strip(),
        "OPENAI_EMBEDDING_MODEL": (vals.get("OPENAI_EMBEDDING_MODEL") or os.environ.get("OPENAI_EMBEDDING_MODEL") or "text-embedding-3-small").strip(),
    }


def _build_azure_embed_url(endpoint: str, deployment: str, api_version: str) -> str:
    ep = endpoint.rstrip("/")
    if "/embeddings" in ep:
        sep = "&" if "?" in ep else "?"
        return ep if "api-version=" in ep else f"{ep}{sep}api-version={api_version}"
    if "/deployments/" in ep:
        return f"{ep}/embeddings?api-version={api_version}"
    return f"{ep}/openai/deployments/{deployment}/embeddings?api-version={api_version}"


class EmbeddingClient:
    """Generates 1536-dimensional embeddings for pgvector."""

    def __init__(self, dimension: int = 1536):
        self.dimension = dimension
        self.timeout = 25.0

    async def get_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for a single string."""
        vectors = await self.get_embeddings([text])
        return vectors[0] if vectors else self._fallback_embedding(text)

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Batch generates embeddings using Azure OpenAI, OpenAI, or local fallback."""
        if not texts:
            return []

        env = _get_active_env()

        # 1. Try Azure OpenAI
        if env["AZURE_OPENAI_API_KEY"] and env["AZURE_OPENAI_ENDPOINT"] and env["AZURE_OPENAI_EMBEDDING_DEPLOYMENT"]:
            try:
                url = _build_azure_embed_url(
                    env["AZURE_OPENAI_ENDPOINT"],
                    env["AZURE_OPENAI_EMBEDDING_DEPLOYMENT"],
                    env["AZURE_OPENAI_API_VERSION"]
                )
                headers = {
                    "api-key": env["AZURE_OPENAI_API_KEY"],
                    "Content-Type": "application/json",
                }
                payload = {
                    "input": texts[:64],  # Process up to 64 chunks per batch
                }
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    r = await client.post(url, headers=headers, json=payload)
                    if r.status_code == 200:
                        data = r.json()
                        raw_data = data.get("data", [])
                        raw_data.sort(key=lambda x: x.get("index", 0))
                        return [item["embedding"] for item in raw_data]
                    else:
                        print(f"[EmbeddingClient] Azure Embeddings note: status {r.status_code} ({r.text[:120]})")
            except Exception as e:
                print(f"[EmbeddingClient] Azure Embeddings error: {e}")

        # 2. Try Standard OpenAI
        if env["OPENAI_API_KEY"]:
            try:
                url = f"{env['OPENAI_BASE_URL'].rstrip('/')}/embeddings"
                headers = {
                    "Authorization": f"Bearer {env['OPENAI_API_KEY']}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "model": env["OPENAI_EMBEDDING_MODEL"],
                    "input": texts[:64],
                }
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    r = await client.post(url, headers=headers, json=payload)
                    if r.status_code == 200:
                        data = r.json()
                        raw_data = data.get("data", [])
                        raw_data.sort(key=lambda x: x.get("index", 0))
                        return [item["embedding"] for item in raw_data]
            except Exception as e:
                print(f"[EmbeddingClient] OpenAI Embeddings error: {e}")

        # 3. Deterministic Local Normalized Fallback
        return [self._fallback_embedding(t) for t in texts]

    def _fallback_embedding(self, text: str) -> List[float]:
        """
        Deterministic pseudo-semantic vector representation based on term hashing & projections.
        Guarantees exact dimension match and unit norm so pgvector operations work immediately.
        """
        vec = [0.0] * self.dimension
        tokens = text.lower().split()
        if not tokens:
            vec[0] = 1.0
            return vec

        for word in tokens:
            h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dimension
            sign = 1.0 if ((h >> 8) & 1) else -1.0
            vec[idx] += sign

        # L2 Normalize
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        else:
            vec[0] = 1.0
        return vec


embedding_client = EmbeddingClient()

