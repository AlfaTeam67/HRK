from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.repo.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(User, session)

    async def get_by_login(self, login: str) -> User | None:
        result = await self.session.execute(select(User).where(User.login == login))
        return result.scalar_one_or_none()
