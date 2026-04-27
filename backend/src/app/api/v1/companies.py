from math import ceil
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repo.company import CompanyRepository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.company import CompanyCreate, CompanyRead, CompanyUpdate

router = APIRouter()


@router.post("/", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
async def create_company(obj_in: CompanyCreate, db: AsyncSession = Depends(get_db)) -> Any:
    repo = CompanyRepository(db)
    try:
        new_company = await repo.create(obj_in.model_dump())
        await db.commit()
        await db.refresh(new_company)
        return new_company
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company with this name or unique identifier already exists.",
        ) from None


@router.get("/", response_model=PaginatedResponse[CompanyRead])
async def list_companies(
    params: PaginationParams = Depends(), db: AsyncSession = Depends(get_db)
) -> Any:
    repo = CompanyRepository(db)
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


@router.get("/{id}", response_model=CompanyRead)
async def get_company(id: UUID, db: AsyncSession = Depends(get_db)) -> Any:
    repo = CompanyRepository(db)
    company = await repo.get(id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.patch("/{id}", response_model=CompanyRead)
async def update_company(
    id: UUID, obj_in: CompanyUpdate, db: AsyncSession = Depends(get_db)
) -> Any:
    repo = CompanyRepository(db)
    company = await repo.get(id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    try:
        updated_company = await repo.update(company, obj_in.model_dump(exclude_unset=True))
        await db.commit()
        await db.refresh(updated_company)
        return updated_company
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company with this name or unique identifier already exists.",
        ) from None


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    repo = CompanyRepository(db)
    success = await repo.delete(id, soft=True)
    if not success:
        success = await repo.delete(id, soft=False)

    if not success:
        raise HTTPException(status_code=404, detail="Company not found")
    await db.commit()
