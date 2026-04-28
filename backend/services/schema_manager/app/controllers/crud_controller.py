import os

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Any, Dict

from app.service.crud_service import CRUDService

router = APIRouter(prefix="/crud", tags=["CRUD"])
crud_service = CRUDService(
    os.getenv("DATABASE_URL", "postgresql://hrk:hrk_secret@db:5432/hrk_db")
)


class RecordCreate(BaseModel):
    data: Dict[str, Any]


class RecordUpdate(BaseModel):
    data: Dict[str, Any]


@router.post("/{table_name}", status_code=status.HTTP_201_CREATED)
def create_record(table_name: str, record: RecordCreate) -> Any:
    """Create a new record in the specified table."""
    try:
        return crud_service.create(table_name, record.data)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(exc)}"
        ) from exc


@router.get("/{table_name}")
def get_records(table_name: str, skip: int = 0, limit: int = 100) -> Any:
    """Get all records from the specified table with pagination."""
    try:
        return crud_service.get_multi(table_name, skip=skip, limit=limit)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(exc)}"
        ) from exc


@router.get("/{table_name}/{record_id}")
def get_record(table_name: str, record_id: int) -> Any:
    """Get a specific record by ID from the specified table."""
    try:
        return crud_service.get(table_name, record_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(exc)}"
        ) from exc


@router.patch("/{table_name}/{record_id}")
def update_record(table_name: str, record_id: int, record: RecordUpdate) -> Any:
    """Update a specific record by ID in the specified table."""
    try:
        return crud_service.update(table_name, record_id, record.data)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(exc)}"
        ) from exc


@router.delete("/{table_name}/{record_id}")
def delete_record(table_name: str, record_id: int) -> Any:
    """Delete a specific record by ID from the specified table."""
    try:
        return crud_service.delete(table_name, record_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(exc)}"
        ) from exc
