from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attachment import Attachment
from app.models.enums import OcrStatus
from app.repo.base import BaseRepository


class AttachmentRepository(BaseRepository[Attachment]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Attachment, session)

    async def get_by_ids(self, ids: list[UUID]) -> Sequence[Attachment]:
        if not ids:
            return []
        query = select(Attachment).where(
            Attachment.id.in_(ids), Attachment.deleted_at.is_(None)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def list_excluding_status(
        self,
        *,
        customer_id: UUID | None = None,
        contract_id: UUID | None = None,
        company_id: UUID | None = None,
        excluded_status: OcrStatus,
    ) -> Sequence[Attachment]:
        query = (
            select(Attachment)
            .where(Attachment.deleted_at.is_(None))
            .where(Attachment.ocr_status != excluded_status.value)
        )
        if customer_id is not None:
            query = query.where(Attachment.customer_id == customer_id)
        if contract_id is not None:
            query = query.where(Attachment.contract_id == contract_id)
        if company_id is not None:
            query = query.where(Attachment.company_id == company_id)
        result = await self.session.execute(query)
        return result.scalars().all()
