"""HTTP client for the standalone Reranker microservice."""

import httpx

from app.config import settings
from app.schemas.rag import ChunkResult


class RerankerClient:
    async def rerank(self, query: str, chunks: list[ChunkResult], top_k: int) -> list[ChunkResult]:
        if not chunks:
            return []

        documents = [{"id": str(c.chunk_id), "text": c.content} for c in chunks]

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.reranker_url}/api/rerank",
                json={"query": query, "documents": documents},
            )
            response.raise_for_status()
            results = response.json()

        # results is a list of dicts: [{"id": "...", "text": "...", "score": ...}, ...]
        # We need to map scores back to chunks
        score_map = {res["id"]: res["score"] for res in results}

        for chunk in chunks:
            chunk_id_str = str(chunk.chunk_id)
            if chunk_id_str in score_map:
                chunk.score = score_map[chunk_id_str]

        # Sort descending by score
        chunks.sort(key=lambda c: c.score, reverse=True)
        
        return chunks[:top_k]
