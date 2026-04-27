from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.user import UserRead
from app.service.ad_login import ADLoginService

router = APIRouter()
service = ADLoginService()


@router.post("/login/{username}", response_model=UserRead)
async def login(username: str, db: AsyncSession = Depends(get_db)) -> UserRead:
    try:
        user = await service.login(username, db)
        await db.commit()
        return user
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this login already exists.",
        ) from None
