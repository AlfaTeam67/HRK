from math import ceil
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repo.user import UserRepository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter()


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(obj_in: UserCreate, db: AsyncSession = Depends(get_db)) -> Any:
    repo = UserRepository(db)
    try:
        new_user = await repo.create(obj_in.model_dump())
        await db.commit()
        await db.refresh(new_user)
        return new_user
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this login or email already exists.",
        ) from None


@router.get("/", response_model=PaginatedResponse[UserRead])
async def list_users(
    params: PaginationParams = Depends(), db: AsyncSession = Depends(get_db)
) -> Any:
    repo = UserRepository(db)
    skip = (params.page - 1) * params.page_size
    items = await repo.get_multi(skip=skip, limit=params.page_size)
    total = await repo.count()

    return PaginatedResponse(
        items=items,
        total=total,
        page=params.page,
        page_size=params.page_size,
        pages=ceil(total / params.page_size) if total > 0 else 0,
    )


@router.get("/{id}", response_model=UserRead)
async def get_user(id: UUID, db: AsyncSession = Depends(get_db)) -> Any:
    repo = UserRepository(db)
    user = await repo.get(id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{id}", response_model=UserRead)
async def update_user(id: UUID, obj_in: UserUpdate, db: AsyncSession = Depends(get_db)) -> Any:
    repo = UserRepository(db)
    user = await repo.get(id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        updated_user = await repo.update(user, obj_in.model_dump(exclude_unset=True))
        await db.commit()
        await db.refresh(updated_user)
        return updated_user
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this login or email already exists.",
        ) from None


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    repo = UserRepository(db)
    success = await repo.delete(id, soft=True)
    if not success:
        success = await repo.delete(id, soft=False)

    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    await db.commit()
