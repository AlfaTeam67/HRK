"""GUS CPI endpoint."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.gus import GusCpiResponse
from app.service.gus import GUSService

router = APIRouter()


@router.get("/cpi", response_model=GusCpiResponse, summary="Aktualny wskaźnik CPI z GUS BDL")
async def get_cpi(db: Annotated[AsyncSession, Depends(get_db)]) -> GusCpiResponse:
    svc = GUSService(db)
    s = await svc.get_latest_snapshot()
    return GusCpiResponse(value=s.value, year=s.year, quarter=s.quarter, source=s.source, fetched_at=s.fetched_at)
