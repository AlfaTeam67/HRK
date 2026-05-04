import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.dashboard import DashboardKpi
from app.service.alert import AlertService

router = APIRouter()


@router.get("/kpi", response_model=DashboardKpi)
async def get_dashboard_kpi(
    account_manager_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> DashboardKpi:
    service = AlertService(db)
    return await service.get_dashboard_kpi(account_manager_id=account_manager_id)
