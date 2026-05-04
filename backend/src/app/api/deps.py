"""API dependencies for CRM modules."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.service import CRMService


def get_crm_service(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CRMService:
    """Provide CRM service instance bound to request DB session."""
    return CRMService(db, current_user=current_user)
