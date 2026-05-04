"""Activity log API endpoints."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_crm_service
from app.schemas.activity import ActivityLogCreate, ActivityLogRead
from app.service import CRMService

router = APIRouter(tags=["crm-activity-log"])


@router.get("/activity-log", response_model=list[ActivityLogRead], summary="List activity log")
async def list_activity_log(
    service: Annotated[CRMService, Depends(get_crm_service)],
    customer_id: uuid.UUID | None = Query(default=None),
    contract_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> Any:
    return await service.list_activity_logs(
        customer_id=customer_id,
        contract_id=contract_id,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/activity-log",
    response_model=ActivityLogRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create activity log entry",
)
async def create_activity_log(
    payload: ActivityLogCreate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> Any:
    return await service.create_activity_log(payload, performed_by=None)
