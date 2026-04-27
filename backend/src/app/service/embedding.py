"""Embedding service — wraps ollama nomic-embed-text via HTTP."""

import httpx

from app.config import settings


class EmbeddingService:
    async def embed(self, text: str) -> list[float]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.ollama_url}/api/embeddings",
                json={"model": settings.ollama_embed_model, "prompt": text},
            )
            response.raise_for_status()
            return response.json()["embedding"]  # type: ignore[no-any-return]
