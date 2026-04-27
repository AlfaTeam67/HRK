"""API dependencies for CRM modules."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.service.crm import CRMService


def get_crm_service(db: Annotated[AsyncSession, Depends(get_db)]) -> CRMService:
    """Provide CRM service instance bound to request DB session."""

    return CRMService(db)
