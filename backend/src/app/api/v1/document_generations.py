"""API endpoints for AI-assisted document generation."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.document_generation import (
    DocumentTemplateRead,
    GenerationAccept,
    GenerationDraftDataUpdate,
    GenerationPreviewResponse,
    GenerationRead,
    GenerationRequest,
)
from app.service.document_generation.service import DocumentGenerationService

router = APIRouter()


def get_generation_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DocumentGenerationService:
    return DocumentGenerationService(db)


@router.get("/templates", response_model=list[DocumentTemplateRead])
async def list_templates(
    service: Annotated[DocumentGenerationService, Depends(get_generation_service)],
) -> Any:
    return await service.list_templates()


@router.post("/preview", response_model=GenerationPreviewResponse)
async def preview_generation(
    request: GenerationRequest,
    service: Annotated[DocumentGenerationService, Depends(get_generation_service)],
) -> Any:
    return await service.preview(request)


@router.post(
    "/",
    response_model=GenerationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Finalize generation — renders PDF (DRAFT) and persists snapshot",
)
async def create_generation(
    request: GenerationRequest,
    generated_by: Annotated[uuid.UUID, Query(description="UUID of the user")],
    service: Annotated[DocumentGenerationService, Depends(get_generation_service)],
) -> Any:
    return await service.finalize(request, generated_by=generated_by)


@router.get("/", response_model=list[GenerationRead])
async def list_generations(
    customer_id: Annotated[uuid.UUID, Query()],
    service: Annotated[DocumentGenerationService, Depends(get_generation_service)],
) -> Any:
    return await service.list_for_customer(customer_id)


@router.get("/{generation_id}", response_model=GenerationRead)
async def get_generation(
    generation_id: uuid.UUID,
    service: Annotated[DocumentGenerationService, Depends(get_generation_service)],
) -> Any:
    return await service.get(generation_id)


@router.post(
    "/{generation_id}/accept",
    response_model=GenerationRead,
    summary="Accept the previewed PDF — removes DRAFT watermark and locks the document",
)
async def accept_generation(
    generation_id: uuid.UUID,
    payload: GenerationAccept,
    background_tasks: BackgroundTasks,
    service: Annotated[DocumentGenerationService, Depends(get_generation_service)],
) -> Any:
    return await service.accept(
        generation_id,
        accepted_by=payload.accepted_by,
        background_tasks=background_tasks,
    )


@router.post(
    "/{generation_id}/reject",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark a generation as rejected",
)
async def reject_generation(
    generation_id: uuid.UUID,
    rejected_by: Annotated[uuid.UUID, Query()],
    service: Annotated[DocumentGenerationService, Depends(get_generation_service)],
) -> Response:
    await service.reject(generation_id, rejected_by=rejected_by)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/{generation_id}/draft-data",
    response_model=GenerationRead,
    summary="Edit AI-generated narrative before acceptance (cover letter, rationale, note)",
)
async def update_draft_data(
    generation_id: uuid.UUID,
    payload: GenerationDraftDataUpdate,
    updated_by: Annotated[uuid.UUID, Query(description="UUID of the user making the edit")],
    service: Annotated[DocumentGenerationService, Depends(get_generation_service)],
) -> Any:
    """Update editable narrative fields on a PREVIEW/DRAFT generation.

    This endpoint lets an operator correct the AI-generated cover letter text
    and/or rationale bullets before accepting the document. It does **not**
    touch financial figures, simulation data, or PDF bytes — those are
    recalculated from the unchanged ``payload`` at acceptance time.

    Returns the updated GenerationRead record.
    """
    return await service.update_draft_data(
        generation_id,
        patch=payload,
        updated_by=updated_by,
    )


@router.get(
    "/{generation_id}/preview-html",
    summary="Re-render generation HTML (debug / iframe preview helper)",
)
async def get_generation_preview_html(
    generation_id: uuid.UUID,
    service: Annotated[DocumentGenerationService, Depends(get_generation_service)],
) -> Any:
    gen = await service.get(generation_id)
    if not gen.payload:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Generation has no payload")
    return {"payload": gen.payload, "ai_artifacts": gen.ai_artifacts}
