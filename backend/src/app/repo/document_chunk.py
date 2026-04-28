"""DocumentChunk repository — bulk insert + vector similarity search."""

from typing import Any
from uuid import UUID

from sqlalchemy import select, text
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
    ) -> list[tuple[Any, float]]:
        vec_str = "[" + ",".join(str(v) for v in embedding) + "]"
        stmt = text("""
            SELECT id, attachment_id, content, page_number, bbox, section_title,
                   (embedding <=> CAST(:vec AS vector(768))) AS score
            FROM document_chunks
            WHERE customer_id = :customer_id
            ORDER BY score ASC
            LIMIT :top_k
        """)
        result = await self.session.execute(
            stmt,
            {"vec": vec_str, "customer_id": str(customer_id), "top_k": top_k},
        )
        rows = result.all()
        return [(row, float(row.score)) for row in rows]

    async def delete_by_attachment(self, attachment_id: UUID) -> None:
        chunks = await self.session.execute(
            select(DocumentChunk).where(DocumentChunk.attachment_id == attachment_id)
        )
        for chunk in chunks.scalars().all():
            await self.session.delete(chunk)
        await self.session.flush()
