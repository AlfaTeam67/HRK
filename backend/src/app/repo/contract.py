from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.repo.base import BaseRepository


class ContractRepository(BaseRepository[Contract]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Contract, session)
