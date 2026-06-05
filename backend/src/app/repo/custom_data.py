"""Repository for custom data definitions."""

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.custom_data import (
    CustomColumnDefinition,
    CustomFieldDefinition,
    CustomTableDefinition,
)


class CustomFieldDefinitionRepo:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_customer(self, customer_id: uuid.UUID) -> list[CustomFieldDefinition]:
        stmt = (
            select(CustomFieldDefinition)
            .where(CustomFieldDefinition.customer_id == customer_id)
            .order_by(CustomFieldDefinition.sort_order)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get(self, field_id: uuid.UUID) -> CustomFieldDefinition | None:
        return await self.db.get(CustomFieldDefinition, field_id)

    async def create(self, data: dict[str, Any]) -> CustomFieldDefinition:
        obj = CustomFieldDefinition(**data)
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def delete(self, obj: CustomFieldDefinition) -> None:
        await self.db.delete(obj)
        await self.db.flush()

    async def count_for_customer(self, customer_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(CustomFieldDefinition)
            .where(CustomFieldDefinition.customer_id == customer_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0


class CustomTableDefinitionRepo:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_customer(self, customer_id: uuid.UUID) -> list[CustomTableDefinition]:
        stmt = (
            select(CustomTableDefinition)
            .where(CustomTableDefinition.customer_id == customer_id)
            .options(selectinload(CustomTableDefinition.columns))
            .order_by(CustomTableDefinition.sort_order)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get(self, table_id: uuid.UUID) -> CustomTableDefinition | None:
        stmt = (
            select(CustomTableDefinition)
            .where(CustomTableDefinition.id == table_id)
            .options(selectinload(CustomTableDefinition.columns))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, data: dict[str, Any]) -> CustomTableDefinition:
        columns_data = data.pop("columns", [])
        obj = CustomTableDefinition(**data)
        for col_data in columns_data:
            obj.columns.append(CustomColumnDefinition(**col_data))
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj, attribute_names=["columns"])
        return obj

    async def delete(self, obj: CustomTableDefinition) -> None:
        await self.db.delete(obj)
        await self.db.flush()

    async def count_for_customer(self, customer_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(CustomTableDefinition)
            .where(CustomTableDefinition.customer_id == customer_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0


class CustomColumnDefinitionRepo:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, col_id: uuid.UUID) -> CustomColumnDefinition | None:
        return await self.db.get(CustomColumnDefinition, col_id)

    async def create(self, data: dict[str, Any]) -> CustomColumnDefinition:
        obj = CustomColumnDefinition(**data)
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def delete(self, obj: CustomColumnDefinition) -> None:
        await self.db.delete(obj)
        await self.db.flush()

    async def count_for_table(self, table_def_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(CustomColumnDefinition)
            .where(CustomColumnDefinition.table_def_id == table_def_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0
