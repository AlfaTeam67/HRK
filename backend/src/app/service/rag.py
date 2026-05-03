"""RAG orchestration — embed query → vector search → optional LLM synthesis."""

import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.repo.document_chunk import DocumentChunkRepository
from app.schemas.rag import ChunkResult, RagSearchRequest, RagSearchResponse
from app.service.embedding import EmbeddingService
from app.service.llm import LLMService

_STOPWORDS = {
    "kiedy",
    "jak",
    "czy",
    "co",
    "się",
    "na",
    "w",
    "z",
    "i",
    "a",
    "że",
    "jest",
    "są",
    "był",
    "the",
    "is",
    "of",
    "in",
    "and",
}


def _best_sentence(query: str, content: str) -> str | None:
    query_words = {
        w for w in re.findall(r"\w+", query.lower()) if w not in _STOPWORDS and len(w) > 2
    }
    if not query_words:
        return None
    sentences = [
        s.strip()
        for s in re.split(r"\n|(?<=[.!?])\s+(?=[A-ZŻŹĆĄŚĘŁÓŃ\(])", content)
        if len(s.strip()) > 5
    ]
    if not sentences:
        return None

    def score(s: str) -> tuple[int, int]:
        words = set(re.findall(r"\w+", s.lower()))
        overlap = len(words & query_words)
        return (overlap, len(s))

    best = max(sentences, key=score)
    overlap, _ = score(best)
    return best if overlap > 0 else None


class RAGService:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        llm_service: LLMService,
    ) -> None:
        self._embed = embedding_service
        self._llm = llm_service

    async def search(self, req: RagSearchRequest, db: AsyncSession) -> RagSearchResponse:
        query_embedding = await self._embed.embed(req.query)

        repo = DocumentChunkRepository(db)
        results = await repo.search(req.customer_id, query_embedding, req.top_k)

        chunks = [
            ChunkResult(
                chunk_id=chunk.id,
                attachment_id=chunk.attachment_id,
                content=chunk.content,
                highlight=_best_sentence(req.query, chunk.content),
                page_number=chunk.page_number,
                bbox=chunk.bbox,
                section_title=chunk.section_title,
                score=score,
            )
            for chunk, score in results
        ]

        ai_answer: str | None = None
        if req.ai_mode and chunks:
            ai_answer = await self._llm.generate(req.query, [c.content for c in chunks])

        return RagSearchResponse(chunks=chunks, ai_answer=ai_answer)
