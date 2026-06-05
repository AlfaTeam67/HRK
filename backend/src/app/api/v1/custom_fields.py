"""Custom fields API endpoints."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.database import get_db
from app.schemas.custom_data import (
    CustomFieldDefinitionCreate,
    CustomFieldDefinitionRead,
    CustomFieldValuesRead,
    CustomFieldValuesUpdate,
)
from app.service.custom_data import CustomDataService

router = APIRouter()


def _get_service(db: Annotated[AsyncSession, Depends(get_db)]) -> CustomDataService:
    return CustomDataService(db, schema_manager_url=settings.schema_manager_url)


@router.get(
    "/{customer_id}/custom-fields/definitions",
    response_model=list[CustomFieldDefinitionRead],
)
async def list_field_definitions(
    customer_id: uuid.UUID,
    service: Annotated[CustomDataService, Depends(_get_service)],
) -> Any:
    return await service.list_field_definitions(customer_id)


@router.post(
    "/{customer_id}/custom-fields/definitions",
    response_model=CustomFieldDefinitionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_field_definition(
    customer_id: uuid.UUID,
    payload: CustomFieldDefinitionCreate,
    service: Annotated[CustomDataService, Depends(_get_service)],
) -> Any:
    return await service.create_field_definition(customer_id, payload)


@router.delete(
    "/{customer_id}/custom-fields/definitions/{field_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_field_definition(
    customer_id: uuid.UUID,
    field_id: uuid.UUID,
    service: Annotated[CustomDataService, Depends(_get_service)],
) -> None:
    await service.delete_field_definition(field_id, customer_id)


@router.get("/{customer_id}/custom-fields", response_model=CustomFieldValuesRead)
async def get_field_values(
    customer_id: uuid.UUID,
    service: Annotated[CustomDataService, Depends(_get_service)],
) -> Any:
    values = await service.get_field_values(customer_id)
    return CustomFieldValuesRead(values=values)


@router.patch("/{customer_id}/custom-fields", response_model=CustomFieldValuesRead)
async def update_field_values(
    customer_id: uuid.UUID,
    payload: CustomFieldValuesUpdate,
    service: Annotated[CustomDataService, Depends(_get_service)],
) -> Any:
    values = await service.update_field_values(customer_id, payload)
    return CustomFieldValuesRead(values=values)
