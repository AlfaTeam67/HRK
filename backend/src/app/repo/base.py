from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any, TypeVar, cast
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository[ModelType: Base]:
    def __init__(self, model: type[ModelType], session: AsyncSession):
        self.model = model
        self.session = session

    async def get(self, id: UUID) -> ModelType | None:
        model_any = cast(Any, self.model)
        query = select(self.model).where(model_any.id == id)
        if hasattr(self.model, "deleted_at"):
            query = query.where(model_any.deleted_at.is_(None))
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_multi(
        self, *, skip: int = 0, limit: int = 100, include_deleted: bool = False
    ) -> Sequence[ModelType]:
        query = select(self.model).offset(skip).limit(limit)
        if not include_deleted and hasattr(self.model, "deleted_at"):
            model_any = cast(Any, self.model)
            query = query.where(model_any.deleted_at.is_(None))
        result = await self.session.execute(query)
        return result.scalars().all()

    async def list(self, **filters: Any) -> Sequence[ModelType]:
        query = select(self.model)
        model_any = cast(Any, self.model)
        for field, value in filters.items():
            if value is not None:
                query = query.where(getattr(model_any, field) == value)

        if hasattr(self.model, "deleted_at"):
            query = query.where(model_any.deleted_at.is_(None))

        result = await self.session.execute(query)
        return result.scalars().all()

    async def count(self, *, include_deleted: bool = False) -> int:
        query = select(func.count()).select_from(self.model)
        if not include_deleted and hasattr(self.model, "deleted_at"):
            model_any = cast(Any, self.model)
            query = query.where(model_any.deleted_at.is_(None))
        result = await self.session.execute(query)
        return result.scalar() or 0

    async def create(self, obj_in: dict[str, Any]) -> ModelType:
        db_obj = self.model(**obj_in)
        self.session.add(db_obj)
        await self.session.flush()
        await self.session.refresh(db_obj)
        return db_obj

    async def update(self, db_obj: ModelType, obj_in: dict[str, Any]) -> ModelType:
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        self.session.add(db_obj)
        await self.session.flush()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete(self, id: UUID, soft: bool = True) -> bool:
        """Delete an item."""
        db_obj = await self.get(id)
        if not db_obj:
            return False

        if soft:
            if not hasattr(self.model, "deleted_at"):
                # Return False or could raise an exception to prevent accidental hard delete
                return False
            cast(Any, db_obj).deleted_at = datetime.now(UTC)
            self.session.add(db_obj)
        else:
            await self.session.delete(db_obj)

        await self.session.flush()
        return True
