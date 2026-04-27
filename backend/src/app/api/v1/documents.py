from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import (
    DocumentAccessDeniedError,
    DocumentError,
    DocumentNotFoundError,
    DocumentStorageError,
    DocumentValidationError,
)
from app.core.storage import get_storage_service
from app.models.enums import DocumentType
from app.schemas.document import DocumentDownloadURLRead, DocumentRead
from app.service.document import DocumentService

router = APIRouter()


async def get_document_service(db: AsyncSession = Depends(get_db)) -> DocumentService:
    return DocumentService(db, storage_service=get_storage_service())


@router.post("/", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    document_type: DocumentType = Form(DocumentType.OTHER),
    company_id: str | None = Form(None),
    customer_id: str | None = Form(None),
    contract_id: str | None = Form(None),
    uploaded_by: str = Form(...),
    service: DocumentService = Depends(get_document_service),
) -> Any:
    try:
        parsed_company_id = UUID(company_id) if company_id else None
        parsed_customer_id = UUID(customer_id) if customer_id else None
        parsed_contract_id = UUID(contract_id) if contract_id else None
        if not uploaded_by:
            raise ValueError("uploaded_by is required")
        parsed_uploaded_by = UUID(uploaded_by)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid UUID format or missing required field",
        ) from exc

    try:
        return await service.upload_document(
            file=file,
            document_type=document_type,
            company_id=parsed_company_id,
            customer_id=parsed_customer_id,
            contract_id=parsed_contract_id,
            uploaded_by=parsed_uploaded_by,
        )
    except DocumentValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except DocumentAccessDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except DocumentStorageError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except DocumentError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.get("/{id}", response_model=DocumentRead)
async def get_document(
    id: UUID, requester_user_id: UUID, service: DocumentService = Depends(get_document_service)
) -> Any:
    try:
        return await service.get_document(document_id=id, requester_user_id=requester_user_id)
    except DocumentValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except DocumentAccessDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{id}/download-url", response_model=DocumentDownloadURLRead)
async def get_download_url(
    id: UUID, requester_user_id: UUID, service: DocumentService = Depends(get_document_service)
) -> Any:
    try:
        url, expires_in = await service.get_download_url(
            document_id=id, requester_user_id=requester_user_id
        )
        return {"url": url, "expires_in": expires_in}
    except DocumentValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except DocumentAccessDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DocumentStorageError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    id: UUID, requester_user_id: UUID, service: DocumentService = Depends(get_document_service)
) -> None:
    try:
        await service.delete_document(document_id=id, requester_user_id=requester_user_id)
    except DocumentValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except DocumentAccessDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DocumentStorageError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
