"""LLM service — OpenRouter (OpenAI-compatible API).

To switch to local ollama later:
  OPENROUTER_BASE_URL=http://ollama:11434/v1
  OPENROUTER_API_KEY=ollama
  OPENROUTER_MODEL=gemma3:4b  (or whichever model you pulled)
"""

import json
from collections.abc import AsyncIterator

import httpx

from app.config import settings

_SYSTEM_PROMPT = (
    "Jesteś asystentem CRM analizującym dokumenty klientów. "
    "Odpowiadaj wyłącznie na podstawie podanego kontekstu. "
    "Jeśli odpowiedź nie wynika z kontekstu, powiedz to wprost."
)


_SUMMARY_SYSTEM_PROMPT = (
    "Jesteś analitykiem CRM. Na podstawie podanych danych o kliencie wygeneruj "
    "krótkie podsumowanie (3-4 zdania) w języku polskim. "
    "Odpowiedz wyłącznie treścią podsumowania, bez nagłówków ani list."
)


class LLMService:
    async def summarize(self, prompt: str) -> str:
        headers: dict[str, str] = {"Authorization": f"Bearer {settings.openrouter_api_key}"}
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": settings.openrouter_model,
                    "messages": [
                        {"role": "system", "content": _SUMMARY_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            if response.status_code == 429:
                return "Model jest chwilowo przeciążony (rate limit). Spróbuj ponownie za chwilę."
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]  # type: ignore[no-any-return]

    async def stream_summarize(self, prompt: str) -> AsyncIterator[str]:
        headers: dict[str, str] = {"Authorization": f"Bearer {settings.openrouter_api_key}"}
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": settings.openrouter_model,
                    "stream": True,
                    "messages": [
                        {"role": "system", "content": _SUMMARY_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                },
            ) as response:
                if response.status_code == 429:
                    yield "Model jest chwilowo przeciążony (rate limit). Spróbuj ponownie za chwilę."
                    return
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

    async def generate(self, query: str, context_chunks: list[str]) -> str:
        context = "\n\n".join(f"[{i + 1}] {chunk}" for i, chunk in enumerate(context_chunks))
        headers: dict[str, str] = {"Authorization": f"Bearer {settings.openrouter_api_key}"}

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": settings.openrouter_model,
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": f"Kontekst:\n{context}\n\nPytanie: {query}",
                        },
                    ],
                },
            )
            if response.status_code == 429:
                return "Model jest chwilowo przeciążony (rate limit). Spróbuj ponownie za chwilę."
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]  # type: ignore[no-any-return]
