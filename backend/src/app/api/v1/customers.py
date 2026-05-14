"""Customer endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.customers import AiSummaryResponse
from app.service.ai_summary import CustomerAiSummaryService
from app.service.llm import LLMService

router = APIRouter()


@router.post("/{customer_id}/ai-summary", response_model=AiSummaryResponse)
async def get_ai_summary(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Any:
    service = CustomerAiSummaryService(db, LLMService())
    try:
        return await service.generate(customer_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{customer_id}/ai-summary/stream")
async def stream_ai_summary(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    service = CustomerAiSummaryService(db, LLMService())
    return StreamingResponse(
        service.stream(customer_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
