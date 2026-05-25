"""HTTP client for the standalone Reranker microservice."""

import logging

import httpx

from app.config import settings
from app.schemas.rag import ChunkResult

logger = logging.getLogger(__name__)


class RerankerClient:
    async def rerank(self, query: str, chunks: list[ChunkResult], top_k: int) -> list[ChunkResult]:
        if not chunks:
            return []

        documents = [{"id": str(c.chunk_id), "text": c.content} for c in chunks]

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{settings.reranker_url}/api/rerank",
                    json={"query": query, "documents": documents},
                )
                response.raise_for_status()
                results = response.json()
        except httpx.HTTPError as exc:
            logger.warning("Reranker unavailable (%s), falling back to vec scores", exc)
            chunks.sort(key=lambda c: c.score)
            return chunks[:top_k]

        # results is a list of dicts: [{"id": "...", "text": "...", "score": ...}, ...]
        score_map = {res["id"]: res["score"] for res in results}

        for chunk in chunks:
            chunk_id_str = str(chunk.chunk_id)
            if chunk_id_str in score_map:
                chunk.score = score_map[chunk_id_str]

        chunks.sort(key=lambda c: c.score, reverse=True)

        return chunks[:top_k]
