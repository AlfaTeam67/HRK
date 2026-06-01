"""Reports API endpoints."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.enums import ActivityType
from app.schemas.activity import ActivityLogReportResponse
from app.service.reports import ReportsService

router = APIRouter()

_VALID_PERIODS = {7, 30, 90, 180, 365}


async def get_reports_service(db: Annotated[AsyncSession, Depends(get_db)]) -> ReportsService:
    return ReportsService(db)


@router.get("/activity", response_model=ActivityLogReportResponse, summary="Activity log report")
async def get_activity_report(
    service: Annotated[ReportsService, Depends(get_reports_service)],
    current_user_id: uuid.UUID = Query(...),
    period: int = Query(default=30),
    user_id: uuid.UUID | None = Query(default=None),
    customer_id: uuid.UUID | None = Query(default=None),
    activity_type: ActivityType | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> Any:
    if period not in _VALID_PERIODS:
        period = 30
    return await service.get_activity_report(
        current_user_id=current_user_id,
        period_days=period,
        filter_user_id=user_id,
        customer_id=customer_id,
        activity_type=activity_type,
        limit=limit,
        offset=offset,
    )
