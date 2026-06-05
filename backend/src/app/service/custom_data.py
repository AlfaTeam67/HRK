"""Business logic for custom data (fields + tables)."""

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_data import CustomFieldDefinition, CustomTableDefinition
from app.repo.custom_data import (
    CustomColumnDefinitionRepo,
    CustomFieldDefinitionRepo,
    CustomTableDefinitionRepo,
)
from app.schemas.custom_data import (
    ALLOWED_FIELD_TYPES,
    CustomColumnCreate,
    CustomFieldDefinitionCreate,
    CustomFieldValuesUpdate,
    CustomTableCreate,
)
from app.service.schema_manager_client import SchemaManagerClient

MAX_FIELDS_PER_CUSTOMER = 20
MAX_TABLES_PER_CUSTOMER = 10
MAX_COLUMNS_PER_TABLE = 20


class CustomDataService:
    """Manages custom field definitions, custom tables, and their data."""

    def __init__(self, db: AsyncSession, schema_manager_url: str) -> None:
        self.db = db
        self.field_repo = CustomFieldDefinitionRepo(db)
        self.table_repo = CustomTableDefinitionRepo(db)
        self.column_repo = CustomColumnDefinitionRepo(db)
        self.schema_client = SchemaManagerClient(schema_manager_url)

    # ── Custom Fields ──────────────────────────────────────────────────────────

    async def list_field_definitions(
        self, customer_id: uuid.UUID
    ) -> list[CustomFieldDefinition]:
        return await self.field_repo.list_for_customer(customer_id)

    async def create_field_definition(
        self,
        customer_id: uuid.UUID,
        payload: CustomFieldDefinitionCreate,
        created_by: uuid.UUID | None = None,
    ) -> CustomFieldDefinition:
        self._validate_field_type(payload.field_type)
        count = await self.field_repo.count_for_customer(customer_id)
        if count >= MAX_FIELDS_PER_CUSTOMER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum {MAX_FIELDS_PER_CUSTOMER} custom fields per customer.",
            )
        data = payload.model_dump()
        data["customer_id"] = customer_id
        data["created_by"] = created_by
        return await self.field_repo.create(data)

    async def delete_field_definition(
        self, field_id: uuid.UUID, customer_id: uuid.UUID
    ) -> None:
        obj = await self.field_repo.get(field_id)
        if not obj or obj.customer_id != customer_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Field not found"
            )
        from app.repo.customers import CustomerRepository

        cust_repo = CustomerRepository(self.db)
        customer = await cust_repo.get(customer_id)
        if customer and customer.additional_data and obj.field_name in customer.additional_data:
            customer.additional_data = {
                k: v for k, v in customer.additional_data.items() if k != obj.field_name
            }
        await self.field_repo.delete(obj)

    async def get_field_values(self, customer_id: uuid.UUID) -> dict[str, Any]:
        from app.repo.customers import CustomerRepository

        cust_repo = CustomerRepository(self.db)
        customer = await cust_repo.get(customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found"
            )
        definitions = await self.field_repo.list_for_customer(customer_id)
        defined_names = {d.field_name for d in definitions}
        additional = customer.additional_data or {}
        return {k: v for k, v in additional.items() if k in defined_names}

    async def update_field_values(
        self, customer_id: uuid.UUID, payload: CustomFieldValuesUpdate
    ) -> dict[str, Any]:
        from app.repo.customers import CustomerRepository

        cust_repo = CustomerRepository(self.db)
        customer = await cust_repo.get(customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found"
            )
        definitions = await self.field_repo.list_for_customer(customer_id)
        defined_names = {d.field_name for d in definitions}
        for key in payload.values:
            if key not in defined_names:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Field '{key}' is not defined for this customer.",
                )
        updated = {**(customer.additional_data or {}), **payload.values}
        customer.additional_data = updated
        await self.db.flush()
        return {k: v for k, v in updated.items() if k in defined_names}

    # ── Custom Tables ──────────────────────────────────────────────────────────

    async def list_table_definitions(
        self, customer_id: uuid.UUID
    ) -> list[CustomTableDefinition]:
        return await self.table_repo.list_for_customer(customer_id)

    async def get_table_definition(
        self, table_id: uuid.UUID, customer_id: uuid.UUID
    ) -> CustomTableDefinition:
        obj = await self.table_repo.get(table_id)
        if not obj or obj.customer_id != customer_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Table not found"
            )
        return obj

    async def create_table(
        self,
        customer_id: uuid.UUID,
        payload: CustomTableCreate,
        created_by: uuid.UUID | None = None,
    ) -> CustomTableDefinition:
        count = await self.table_repo.count_for_customer(customer_id)
        if count >= MAX_TABLES_PER_CUSTOMER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum {MAX_TABLES_PER_CUSTOMER} custom tables per customer.",
            )
        for col in payload.columns:
            self._validate_field_type(col.column_type)
        if len(payload.columns) > MAX_COLUMNS_PER_TABLE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum {MAX_COLUMNS_PER_TABLE} columns per table.",
            )
        db_table_name = self._generate_table_name(customer_id, payload.table_slug)
        await self.schema_client.create_table(db_table_name)
        try:
            for col in payload.columns:
                await self.schema_client.add_column(
                    db_table_name, col.column_name, col.column_type
                )
        except Exception:
            await self.schema_client.drop_table(db_table_name)
            raise
        data: dict[str, Any] = {
            "customer_id": customer_id,
            "table_slug": payload.table_slug,
            "display_name": payload.display_name,
            "db_table_name": db_table_name,
            "created_by": created_by,
            "columns": [col.model_dump() for col in payload.columns],
        }
        try:
            return await self.table_repo.create(data)
        except Exception:
            await self.schema_client.drop_table(db_table_name)
            raise

    async def delete_table(self, table_id: uuid.UUID, customer_id: uuid.UUID) -> None:
        obj = await self.table_repo.get(table_id)
        if not obj or obj.customer_id != customer_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Table not found"
            )
        await self.schema_client.drop_table(obj.db_table_name)
        await self.table_repo.delete(obj)

    async def add_column(
        self, table_id: uuid.UUID, customer_id: uuid.UUID, payload: CustomColumnCreate
    ) -> None:
        table_def = await self.get_table_definition(table_id, customer_id)
        self._validate_field_type(payload.column_type)
        col_count = await self.column_repo.count_for_table(table_id)
        if col_count >= MAX_COLUMNS_PER_TABLE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum {MAX_COLUMNS_PER_TABLE} columns per table.",
            )
        await self.schema_client.add_column(
            table_def.db_table_name, payload.column_name, payload.column_type
        )
        await self.column_repo.create({**payload.model_dump(), "table_def_id": table_id})

    async def delete_column(
        self, table_id: uuid.UUID, col_id: uuid.UUID, customer_id: uuid.UUID
    ) -> None:
        table_def = await self.get_table_definition(table_id, customer_id)
        col = await self.column_repo.get(col_id)
        if not col or col.table_def_id != table_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Column not found"
            )
        await self.schema_client.drop_column(table_def.db_table_name, col.column_name)
        await self.column_repo.delete(col)

    # ── Row CRUD (proxied to Schema Manager) ───────────────────────────────────

    async def get_rows(
        self, table_id: uuid.UUID, customer_id: uuid.UUID, skip: int = 0, limit: int = 100
    ) -> dict[str, Any]:
        table_def = await self.get_table_definition(table_id, customer_id)
        return await self.schema_client.get_rows(table_def.db_table_name, skip, limit)

    async def insert_row(
        self, table_id: uuid.UUID, customer_id: uuid.UUID, data: dict[str, Any]
    ) -> dict[str, Any]:
        table_def = await self.get_table_definition(table_id, customer_id)
        return await self.schema_client.insert_row(table_def.db_table_name, data)

    async def update_row(
        self, table_id: uuid.UUID, customer_id: uuid.UUID, row_id: int, data: dict[str, Any]
    ) -> dict[str, Any]:
        table_def = await self.get_table_definition(table_id, customer_id)
        return await self.schema_client.update_row(table_def.db_table_name, row_id, data)

    async def delete_row(
        self, table_id: uuid.UUID, customer_id: uuid.UUID, row_id: int
    ) -> None:
        table_def = await self.get_table_definition(table_id, customer_id)
        await self.schema_client.delete_row(table_def.db_table_name, row_id)

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _validate_field_type(self, field_type: str) -> None:
        if field_type.upper() not in ALLOWED_FIELD_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported field_type '{field_type}'. Allowed: {sorted(ALLOWED_FIELD_TYPES)}",
            )

    def _generate_table_name(self, customer_id: uuid.UUID, slug: str) -> str:
        short_id = str(customer_id).replace("-", "")[:8]
        return f"ct_{short_id}_{slug}"
