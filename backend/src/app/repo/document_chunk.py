"""DocumentChunk repository — bulk insert + vector similarity search."""

from typing import Any
from uuid import UUID

from pgvector.sqlalchemy import Vector  # type: ignore
from sqlalchemy import cast, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document_chunk import DocumentChunk
from app.repo.base import BaseRepository


class DocumentChunkRepository(BaseRepository[DocumentChunk]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(DocumentChunk, session)

    async def bulk_insert(self, chunks: list[dict[str, Any]]) -> list[DocumentChunk]:
        objects = [DocumentChunk(**chunk) for chunk in chunks]
        self.session.add_all(objects)
        await self.session.flush()
        return objects

    async def search(
        self,
        customer_id: UUID,
        embedding: list[float],
        top_k: int = 5,
    ) -> list[tuple[DocumentChunk, float]]:
        query_vec = cast(embedding, Vector(768))
        distance = DocumentChunk.embedding.op("<=>")(query_vec)

        stmt = (
            select(DocumentChunk, distance.label("score"))
            .where(DocumentChunk.customer_id == customer_id)
            .order_by(distance)
            .limit(top_k)
        )
        result = await self.session.execute(stmt)
        return [(row.DocumentChunk, float(row.score)) for row in result]

    async def delete_by_attachment(self, attachment_id: UUID) -> None:
        chunks = await self.session.execute(
            select(DocumentChunk).where(DocumentChunk.attachment_id == attachment_id)
        )
        for chunk in chunks.scalars().all():
            await self.session.delete(chunk)
        await self.session.flush()
