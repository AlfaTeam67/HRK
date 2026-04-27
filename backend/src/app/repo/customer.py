from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.repo.base import BaseRepository


class CustomerRepository(BaseRepository[Customer]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Customer, session)
