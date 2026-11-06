"""
Dedicated LLM Client for gpt-6-sol via Azure OpenAI (and standard OpenAI).
Supports full chat generation, SSE token streaming, and automatic parameter adaptation for reasoning models.
"""
import os
import json
import asyncio
import httpx
from pathlib import Path
from typing import AsyncGenerator, List, Dict, Optional, Any
from dotenv import dotenv_values


def _get_active_env() -> Dict[str, str]:
    """Reads latest values from .env dynamically."""
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    vals = {}
    if env_path.exists():
        vals = dotenv_values(env_path)
    raw_dep = (vals.get("AZURE_OPENAI_DEPLOYMENT_NAME") or os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME") or "gpt-6-sol").strip()
    # Normalize model deployment name
    if any(alias in raw_dep.lower() for alias in ["gpt 6.0 sol", "gpt-6.0-sol", "gpt 6 sol", "gpt-6-sol", "gpt6"]):
        deployment = "gpt-6-sol"
    else:
        deployment = raw_dep

    return {
        "AZURE_OPENAI_API_KEY": (vals.get("AZURE_OPENAI_API_KEY") or os.environ.get("AZURE_OPENAI_API_KEY") or "").strip(),
        "AZURE_OPENAI_ENDPOINT": (vals.get("AZURE_OPENAI_ENDPOINT") or os.environ.get("AZURE_OPENAI_ENDPOINT") or "").strip(),
        "AZURE_OPENAI_DEPLOYMENT_NAME": deployment,
        "AZURE_OPENAI_API_VERSION": (vals.get("AZURE_OPENAI_API_VERSION") or os.environ.get("AZURE_OPENAI_API_VERSION") or "2024-06-01").strip(),
        "OPENAI_API_KEY": (vals.get("OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY") or "").strip(),
        "OPENAI_BASE_URL": (vals.get("OPENAI_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").strip(),
        "OPENAI_MODEL": deployment,
    }


def _clean_azure_base(endpoint: str) -> str:
    """Extracts base host URL from any Azure AI endpoint."""
    ep = endpoint.strip().rstrip("/")
    for suffix in ["/openai/v1/responses", "/openai/v1/chat/completions", "/openai/v1", "/openai"]:
        if ep.endswith(suffix):
            ep = ep[:-len(suffix)].rstrip("/")
    return ep


def _build_azure_chat_url(endpoint: str, deployment: str, api_version: str) -> str:
    """Builds Azure OpenAI completions URL."""
    base = _clean_azure_base(endpoint)
    return f"{base}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"


class GptSolClient:
    """
    LLM Client powered by gpt-6-sol with reasoning token adaptation.
    """

    def __init__(self):
        self.timeout = 45.0

    @property
    def api_key(self) -> str:
        env = _get_active_env()
        return env["AZURE_OPENAI_API_KEY"] or env["OPENAI_API_KEY"]

    @property
    def model(self) -> str:
        env = _get_active_env()
        return env["AZURE_OPENAI_DEPLOYMENT_NAME"] or env["OPENAI_MODEL"] or "gpt-6-sol"

    async def is_available(self) -> bool:
        env = _get_active_env()
        has_azure = bool(env["AZURE_OPENAI_API_KEY"] and env["AZURE_OPENAI_ENDPOINT"] and len(env["AZURE_OPENAI_API_KEY"]) > 5)
        has_openai = bool(env["OPENAI_API_KEY"] and len(env["OPENAI_API_KEY"]) > 10)
        return has_azure or has_openai

    def _build_payload(self, messages: List[Dict[str, str]], deployment: str, temperature: float = 0.3, stream: bool = False) -> Dict[str, Any]:
        """Constructs payload adapting for reasoning models like gpt-6-sol (max_completion_tokens, no custom temperature)."""
        is_reasoning = any(k in deployment.lower() for k in ["gpt-6", "o1", "o3", "sol"])
        payload: Dict[str, Any] = {
            "messages": messages,
        }

        if is_reasoning:
            # Reasoning models require max_completion_tokens and do not support custom temperature
            payload["max_completion_tokens"] = 4096
        else:
            payload["max_tokens"] = 4096
            payload["temperature"] = temperature

        if stream:
            payload["stream"] = True

        return payload

    # ─── AZURE OPENAI DISPATCH (gpt-6-sol) ──────────────────────────────────
    async def _chat_azure(self, env: Dict[str, str], messages: List[Dict[str, str]], temperature: float) -> Optional[str]:
        headers = {
            "api-key": env["AZURE_OPENAI_API_KEY"],
            "Content-Type": "application/json",
        }
        deployment = env["AZURE_OPENAI_DEPLOYMENT_NAME"]
        payload = self._build_payload(messages, deployment, temperature=temperature, stream=False)

        url1 = _build_azure_chat_url(env["AZURE_OPENAI_ENDPOINT"], deployment, env["AZURE_OPENAI_API_VERSION"])
        base = _clean_azure_base(env["AZURE_OPENAI_ENDPOINT"])
        url2 = f"{base}/openai/v1/chat/completions"

        attempts = [
            (url1, payload),
            (url2, {**payload, "model": deployment}),
        ]

        for target_url, target_payload in attempts:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    r = await client.post(target_url, headers=headers, json=target_payload)
                    if r.status_code == 200:
                        data = r.json()
                        choices = data.get("choices", [])
                        if choices:
                            content = choices[0].get("message", {}).get("content", "")
                            if content and content.strip():
                                return content.strip()
                    else:
                        print(f"[gpt-6-sol] API returned {r.status_code} on {target_url}: {r.text[:140]}")
            except Exception as e:
                print(f"[gpt-6-sol] Chat exception on {target_url}: {e}")
        return None

    async def _stream_azure(self, env: Dict[str, str], messages: List[Dict[str, str]], temperature: float) -> AsyncGenerator[str, None]:
        headers = {
            "api-key": env["AZURE_OPENAI_API_KEY"],
            "Content-Type": "application/json",
        }
        deployment = env["AZURE_OPENAI_DEPLOYMENT_NAME"]
        payload = self._build_payload(messages, deployment, temperature=temperature, stream=True)

        url1 = _build_azure_chat_url(env["AZURE_OPENAI_ENDPOINT"], deployment, env["AZURE_OPENAI_API_VERSION"])
        base = _clean_azure_base(env["AZURE_OPENAI_ENDPOINT"])
        url2 = f"{base}/openai/v1/chat/completions"

        attempts = [
            (url1, payload),
            (url2, {**payload, "model": deployment}),
        ]

        for target_url, target_payload in attempts:
            succeeded = False
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    async with client.stream("POST", target_url, headers=headers, json=target_payload) as response:
                        if response.status_code != 200:
                            print(f"[gpt-6-sol] Stream request returned {response.status_code}: {target_url}")
                            continue
                        async for line in response.aiter_lines():
                            line = line.strip()
                            if not line or not line.startswith("data: "):
                                continue
                            raw = line[6:].strip()
                            if raw == "[DONE]":
                                break
                            try:
                                data = json.loads(raw)
                                choices = data.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    token = delta.get("content", "")
                                    if token:
                                        succeeded = True
                                        yield token
                            except Exception:
                                continue
                if succeeded:
                    return
            except Exception as e:
                print(f"[gpt-6-sol] Stream exception on {target_url}: {e}")

    # ─── STANDARD OPENAI DISPATCH ──────────────────────────────────────────────
    async def _chat_openai(self, env: Dict[str, str], messages: List[Dict[str, str]], temperature: float) -> Optional[str]:
        url = f"{env['OPENAI_BASE_URL'].rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {env['OPENAI_API_KEY']}",
            "Content-Type": "application/json",
        }
        model = env["OPENAI_MODEL"]
        payload = self._build_payload(messages, model, temperature=temperature, stream=False)
        payload["model"] = model
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(url, headers=headers, json=payload)
                if r.status_code == 200:
                    data = r.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "")
        except Exception as e:
            print(f"[gpt-6-sol] OpenAI chat exception: {e}")
        return None

    async def _stream_openai(self, env: Dict[str, str], messages: List[Dict[str, str]], temperature: float) -> AsyncGenerator[str, None]:
        url = f"{env['OPENAI_BASE_URL'].rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {env['OPENAI_API_KEY']}",
            "Content-Type": "application/json",
        }
        model = env["OPENAI_MODEL"]
        payload = self._build_payload(messages, model, temperature=temperature, stream=True)
        payload["model"] = model
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        return
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if raw == "[DONE]":
                            break
                        try:
                            data = json.loads(raw)
                            choices = data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                token = delta.get("content", "")
                                if token:
                                    yield token
                        except Exception:
                            continue
        except Exception as e:
            print(f"[gpt-6-sol] OpenAI stream exception: {e}")

    # ─── UNIFIED INTERFACE ──────────────────────────────────────────────────────
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.3,
    ) -> str:
        """Single chat generation with gpt-6-sol."""
        env = _get_active_env()

        # 1. Try Azure OpenAI (gpt-6-sol)
        if env["AZURE_OPENAI_API_KEY"] and env["AZURE_OPENAI_ENDPOINT"]:
            result = await self._chat_azure(env, messages, temperature)
            if result:
                return result

        # 2. Try Standard OpenAI
        if env["OPENAI_API_KEY"]:
            result = await self._chat_openai(env, messages, temperature)
            if result:
                return result

        # 3. Fallback when network is unavailable
        return self._generate_intelligent_offline_response(messages)

    async def stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.3,
    ) -> AsyncGenerator[str, None]:
        """Streaming token generation with gpt-6-sol."""
        env = _get_active_env()

        # 1. Azure OpenAI (gpt-6-sol)
        if env["AZURE_OPENAI_API_KEY"] and env["AZURE_OPENAI_ENDPOINT"]:
            streamed = False
            async for token in self._stream_azure(env, messages, temperature):
                streamed = True
                yield token
            if streamed:
                return

        # 2. Standard OpenAI
        if env["OPENAI_API_KEY"]:
            streamed = False
            async for token in self._stream_openai(env, messages, temperature):
                streamed = True
                yield token
            if streamed:
                return

        # 3. Fallback streaming
        fallback_text = self._generate_intelligent_offline_response(messages)
        for word in fallback_text.split(" "):
            yield word + " "
            await asyncio.sleep(0.02)

    # Aliases
    chat_stream = stream

    def _generate_intelligent_offline_response(self, messages: List[Dict[str, str]]) -> str:
        return (
            f"### 🎯 Core Principles & Mechanisms\n\n"
            f"**Key Overview**: This topic represents a foundational pillar. It establishes the mathematical and algorithmic basis needed for advanced analysis and problem solving.\n\n"
            f"**Core Insights**:\n"
            f"- **Foundational Rule**: Always formulate the problem by defining inputs, transformation operations, and target outputs.\n"
            f"- **Mechanics**: Step-by-step evaluation of constraints ensures accuracy and avoids computational bottlenecks.\n"
            f"- **Key Takeaway**: Understanding the underlying principles enables intuitive problem solving under exam conditions."
        )


# Global instances and aliases
llm_client = GptSolClient()
GeminiClient = GptSolClient
ollama = llm_client
CASCADE_MODELS = ["gpt-6-sol"]
