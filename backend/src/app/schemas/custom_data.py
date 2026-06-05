"""Custom data API schemas."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema

ALLOWED_FIELD_TYPES = {"TEXT", "INTEGER", "BOOLEAN", "DATE", "FLOAT"}


# ── Custom Fields ──────────────────────────────────────────────────────────────


class CustomFieldDefinitionCreate(BaseModel):
    field_name: str = Field(min_length=1, max_length=100, pattern=r"^[a-z_][a-z0-9_]*$")
    field_type: str = Field(min_length=1, max_length=20)
    display_name: str = Field(min_length=1, max_length=255)
    sort_order: int = 0


class CustomFieldDefinitionRead(ORMBaseSchema):
    id: uuid.UUID
    customer_id: uuid.UUID
    field_name: str
    field_type: str
    display_name: str
    sort_order: int
    created_at: datetime
    created_by: uuid.UUID | None


class CustomFieldValuesUpdate(BaseModel):
    """Payload: dict of field_name → value."""

    values: dict[str, Any]


class CustomFieldValuesRead(BaseModel):
    values: dict[str, Any]


# ── Custom Tables ──────────────────────────────────────────────────────────────


class CustomColumnCreate(BaseModel):
    column_name: str = Field(min_length=1, max_length=100, pattern=r"^[a-z_][a-z0-9_]*$")
    column_type: str = Field(min_length=1, max_length=20)
    display_name: str = Field(min_length=1, max_length=255)
    sort_order: int = 0


class CustomColumnRead(ORMBaseSchema):
    id: uuid.UUID
    column_name: str
    column_type: str
    display_name: str
    sort_order: int


class CustomTableCreate(BaseModel):
    table_slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z_][a-z0-9_]*$")
    display_name: str = Field(min_length=1, max_length=255)
    columns: list[CustomColumnCreate] = Field(min_length=1)


class CustomTableRead(ORMBaseSchema):
    id: uuid.UUID
    customer_id: uuid.UUID
    table_slug: str
    display_name: str
    db_table_name: str
    sort_order: int
    created_at: datetime
    created_by: uuid.UUID | None
    columns: list[CustomColumnRead]


# ── Row CRUD ───────────────────────────────────────────────────────────────────


class RowCreate(BaseModel):
    data: dict[str, Any]


class RowUpdate(BaseModel):
    data: dict[str, Any]


class RowRead(BaseModel):
    id: int
    data: dict[str, Any]


class RowsListRead(BaseModel):
    items: list[dict[str, Any]]
    count: int
