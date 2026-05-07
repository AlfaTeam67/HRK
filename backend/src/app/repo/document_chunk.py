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
        query_text: str | None = None,
        top_k: int = 5,
    ) -> list[tuple[Any, float]]:
        vec_str = "[" + ",".join(str(v) for v in embedding) + "]"
        
        params: dict[str, Any] = {
            "vec": vec_str, 
            "customer_id": str(customer_id), 
            "top_k": top_k
        }
        
        # Simple keyword boosting
        words = [w.lower() for w in (query_text or "").split() if len(w) > 2]
        boost_clauses = []
        for i, w in enumerate(words[:5]):
            key = f"word_{i}"
            boost_clauses.append(f"(CASE WHEN content ILIKE :{key} THEN 0.2 ELSE 0 END)")
            params[key] = f"%{w}%"
        
        keyword_boost = " + ".join(boost_clauses) if boost_clauses else "0"

        stmt = text(f"""
            SELECT id, attachment_id, content, page_number, bbox, section_title, vec_score, kw_score
            FROM (
                SELECT id, attachment_id, content, page_number, bbox, section_title,
                       (embedding <=> CAST(:vec AS vector(768))) AS vec_score,
                       ({keyword_boost}) AS kw_score
                FROM document_chunks
                WHERE customer_id = :customer_id
            ) sub
            ORDER BY (vec_score - kw_score) ASC
            LIMIT :top_k
        """)
        
        result = await self.session.execute(stmt, params)
        rows = result.all()
        return [(row, float(row.vec_score) - float(row.kw_score)) for row in rows]

    async def delete_by_attachment(self, attachment_id: UUID) -> None:
        chunks = await self.session.execute(
            select(DocumentChunk).where(DocumentChunk.attachment_id == attachment_id)
        )
        for chunk in chunks.scalars().all():
            await self.session.delete(chunk)
        await self.session.flush()
