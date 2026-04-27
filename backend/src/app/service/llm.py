"""LLM service — OpenRouter (OpenAI-compatible API).

To switch to local ollama later:
  OPENROUTER_BASE_URL=http://ollama:11434/v1
  OPENROUTER_API_KEY=ollama
  OPENROUTER_MODEL=gemma3:4b  (or whichever model you pulled)
"""

import httpx

from app.config import settings

_SYSTEM_PROMPT = (
    "Jesteś asystentem CRM analizującym dokumenty klientów. "
    "Odpowiadaj wyłącznie na podstawie podanego kontekstu. "
    "Jeśli odpowiedź nie wynika z kontekstu, powiedz to wprost."
)


class LLMService:
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
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]  # type: ignore[no-any-return]
