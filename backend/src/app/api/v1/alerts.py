import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.alert import AlertRead
from app.service.alert import AlertService

router = APIRouter()


@router.get("/", response_model=list[AlertRead])
async def get_alerts(
    account_manager_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[AlertRead]:
    service = AlertService(db)
    return await service.get_alerts(account_manager_id=account_manager_id)
