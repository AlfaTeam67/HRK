"""Custom tables API endpoints."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.database import get_db
from app.schemas.custom_data import (
    CustomColumnCreate,
    CustomTableCreate,
    CustomTableRead,
    RowCreate,
    RowsListRead,
    RowUpdate,
)
from app.service.custom_data import CustomDataService

router = APIRouter()


def _get_service(db: Annotated[AsyncSession, Depends(get_db)]) -> CustomDataService:
    return CustomDataService(db, schema_manager_url=settings.schema_manager_url)


@router.get("/{customer_id}/custom-tables", response_model=list[CustomTableRead])
async def list_tables(
    customer_id: uuid.UUID,
    service: Annotated[CustomDataService, Depends(_get_service)],
) -> Any:
    return await service.list_table_definitions(customer_id)


@router.post(
    "/{customer_id}/custom-tables",
    response_model=CustomTableRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_table(
    customer_id: uuid.UUID,
    payload: CustomTableCreate,
    service: Annotated[CustomDataService, Depends(_get_service)],
) -> Any:
    return await service.create_table(customer_id, payload)


@router.delete(
    "/{customer_id}/custom-tables/{table_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_table(
    customer_id: uuid.UUID,
    table_id: uuid.UUID,
    service: Annotated[CustomDataService, Depends(_get_service)],
) -> None:
    await service.delete_table(table_id, customer_id)


@router.post(
    "/{customer_id}/custom-tables/{table_id}/columns",
    status_code=status.HTTP_201_CREATED,
)
async def add_column(
    customer_id: uuid.UUID,
    table_id: uuid.UUID,
    payload: CustomColumnCreate,
    service: Annotated[CustomDataService, Depends(_get_service)],
) -> None:
    await service.add_column(table_id, customer_id, payload)


@router.delete(
    "/{customer_id}/custom-tables/{table_id}/columns/{col_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_column(
    customer_id: uuid.UUID,
    table_id: uuid.UUID,
    col_id: uuid.UUID,
    service: Annotated[CustomDataService, Depends(_get_service)],
) -> None:
    await service.delete_column(table_id, col_id, customer_id)


# ── Row CRUD ───────────────────────────────────────────────────────────────────


@router.get("/{customer_id}/custom-tables/{table_id}/rows", response_model=RowsListRead)
async def get_rows(
    customer_id: uuid.UUID,
    table_id: uuid.UUID,
    service: Annotated[CustomDataService, Depends(_get_service)],
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> Any:
    return await service.get_rows(table_id, customer_id, skip, limit)


@router.post(
    "/{customer_id}/custom-tables/{table_id}/rows",
    status_code=status.HTTP_201_CREATED,
)
async def insert_row(
    customer_id: uuid.UUID,
    table_id: uuid.UUID,
    payload: RowCreate,
    service: Annotated[CustomDataService, Depends(_get_service)],
) -> Any:
    return await service.insert_row(table_id, customer_id, payload.data)


@router.patch("/{customer_id}/custom-tables/{table_id}/rows/{row_id}")
async def update_row(
    customer_id: uuid.UUID,
    table_id: uuid.UUID,
    row_id: int,
    payload: RowUpdate,
    service: Annotated[CustomDataService, Depends(_get_service)],
) -> Any:
    return await service.update_row(table_id, customer_id, row_id, payload.data)


@router.delete(
    "/{customer_id}/custom-tables/{table_id}/rows/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_row(
    customer_id: uuid.UUID,
    table_id: uuid.UUID,
    row_id: int,
    service: Annotated[CustomDataService, Depends(_get_service)],
) -> None:
    await service.delete_row(table_id, customer_id, row_id)
