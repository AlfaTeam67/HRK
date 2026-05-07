from math import ceil
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthorizationService, get_current_user
from app.core.database import get_db
from app.models.company import Company
from app.models.enums import UserRole
from app.models.user import User
from app.models.user_company_access import UserCompanyAccess
from app.repo.company import CompanyRepository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.company import CompanyCreate, CompanyRead, CompanyUpdate

router = APIRouter()


@router.post("/", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
async def create_company(
    obj_in: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    repo = CompanyRepository(db)
    authorization = AuthorizationService(db)

    try:
        await authorization.ensure_min_role(user=current_user, min_role=UserRole.ADMIN)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "AUTHORIZATION_DENIED", "message": str(exc)},
        ) from exc

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
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    authorization = AuthorizationService(db)
    roles = await authorization.get_user_roles(current_user.id)
    skip = (params.page - 1) * params.page_size

    if UserRole.ADMIN in roles:
        repo = CompanyRepository(db)
        items = await repo.get_multi(skip=skip, limit=params.page_size)
        total = await repo.count()
    else:
        scope_result = await db.execute(
            select(UserCompanyAccess.company_id).where(UserCompanyAccess.user_id == current_user.id)
        )
        scoped_company_ids = list(scope_result.scalars().all())

        if not scoped_company_ids:
            items = []
            total = 0
        else:
            list_query = (
                select(Company)
                .where(Company.id.in_(scoped_company_ids))
                .where(Company.deleted_at.is_(None))
                .offset(skip)
                .limit(params.page_size)
            )
            items_result = await db.execute(list_query)
            items = list(items_result.scalars().all())

            count_query = (
                select(func.count())
                .select_from(Company)
                .where(Company.id.in_(scoped_company_ids))
                .where(Company.deleted_at.is_(None))
            )
            count_result = await db.execute(count_query)
            total = count_result.scalar() or 0

    return PaginatedResponse(
        items=items,
        total=total,
        page=params.page,
        page_size=params.page_size,
        pages=ceil(total / params.page_size) if total > 0 else 0,
    )


@router.get("/{id}", response_model=CompanyRead)
async def get_company(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    repo = CompanyRepository(db)
    authorization = AuthorizationService(db)
    company = await repo.get(id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    try:
        await authorization.authorize_by_policy(
            user=current_user,
            resource="company",
            action="read",
            resource_company_id=company.id,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "AUTHORIZATION_DENIED", "message": str(exc)},
        ) from exc

    return company


@router.patch("/{id}", response_model=CompanyRead)
async def update_company(
    id: UUID,
    obj_in: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    repo = CompanyRepository(db)
    authorization = AuthorizationService(db)
    company = await repo.get(id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    try:
        await authorization.authorize_by_policy(
            user=current_user,
            resource="company",
            action="update",
            resource_company_id=company.id,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "AUTHORIZATION_DENIED", "message": str(exc)},
        ) from exc

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
async def delete_company(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    repo = CompanyRepository(db)
    authorization = AuthorizationService(db)

    try:
        await authorization.authorize_by_policy(
            user=current_user,
            resource="company",
            action="delete",
            resource_company_id=id,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "AUTHORIZATION_DENIED", "message": str(exc)},
        ) from exc

    success = await repo.delete(id, soft=True)
    if not success:
        success = await repo.delete(id, soft=False)

    if not success:
        raise HTTPException(status_code=404, detail="Company not found")
    await db.commit()
