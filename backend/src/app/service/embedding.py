"""Embedding service — wraps ollama nomic-embed-text via HTTP."""

import httpx

from app.config import settings


class EmbeddingService:
    async def embed(self, text: str) -> list[float]:
        results = await self.embed_batch([text])
        return results[0]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts in a single Ollama request (POST /api/embed)."""
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.ollama_url}/api/embed",
                json={"model": settings.ollama_embed_model, "input": texts},
            )
            response.raise_for_status()
            return response.json()["embeddings"]  # type: ignore[no-any-return]
