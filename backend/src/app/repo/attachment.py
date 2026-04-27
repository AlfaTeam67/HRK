from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attachment import Attachment
from app.repo.base import BaseRepository


class AttachmentRepository(BaseRepository[Attachment]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Attachment, session)
