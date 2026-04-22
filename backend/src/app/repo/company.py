from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.repo.base import BaseRepository


class CompanyRepository(BaseRepository[Company]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Company, session)
