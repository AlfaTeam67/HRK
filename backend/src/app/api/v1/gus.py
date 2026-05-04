"""GUS CPI endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.gus import GusCpiRead
from app.service.gus import GUSService

router = APIRouter()


@router.get("/cpi", response_model=GusCpiRead, summary="Get latest CPI from GUS BDL")
async def get_latest_cpi(db: AsyncSession = Depends(get_db)) -> GusCpiRead:
    service = GUSService(db)
    snapshot = await service.get_latest_snapshot()
    await db.commit()
    return GusCpiRead(
        value=snapshot.value,
        year=snapshot.year,
        quarter=snapshot.quarter,
        source=snapshot.source,
        fetched_at=snapshot.fetched_at,
    )
