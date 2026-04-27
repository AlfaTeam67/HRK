"""RAG orchestration — embed query → vector search → optional LLM synthesis."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.repo.document_chunk import DocumentChunkRepository
from app.schemas.rag import ChunkResult, RagSearchRequest, RagSearchResponse
from app.service.embedding import EmbeddingService
from app.service.llm import LLMService


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
                page_number=chunk.page_number,
                bbox=chunk.bbox,
                section_title=chunk.section_title,
                score=score,
            )
            for chunk, score in results
        ]

        ai_answer: str | None = None
        if req.ai_mode and chunks:
            ai_answer = await self._llm.generate(
                req.query, [c.content for c in chunks]
            )

        return RagSearchResponse(chunks=chunks, ai_answer=ai_answer)
