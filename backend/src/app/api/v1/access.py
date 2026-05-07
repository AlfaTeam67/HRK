from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_admin
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.models.user_company_access import UserCompanyAccess
from app.models.user_contract_access import UserContractAccess
from app.models.user_role import UserRoleAssignment
from app.repo.user import UserRepository
from app.schemas.access import AccessAssignmentsRead, RolesUpdateRequest, ScopeUpdateRequest

router = APIRouter()


@router.post("/bootstrap-first-admin", response_model=AccessAssignmentsRead)
async def bootstrap_first_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Idempotent self-bootstrap of the first admin in a fresh system.

    Rules:
    - Requires a valid bearer token (current_user must exist).
    - If no admin exists yet -> grants ADMIN to current_user (idempotent).
    - If current_user is already admin -> no-op, returns assignments.
    - If another user already holds ADMIN -> 403 (use /access/users/.../roles instead).

    Designed so Postman / E2E suites can run end-to-end on a clean DB without
    requiring a manual SQL seed of the first admin.
    """
    admin_rows = await db.execute(
        select(UserRoleAssignment.user_id).where(UserRoleAssignment.role == UserRole.ADMIN)
    )
    admin_user_ids = set(admin_rows.scalars().all())

    if admin_user_ids and current_user.id not in admin_user_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "AUTHORIZATION_DENIED",
                "message": (
                    "An admin already exists; bootstrap is locked. "
                    "Use PUT /access/users/{user_id}/roles as an existing admin."
                ),
            },
        )

    if current_user.id not in admin_user_ids:
        db.add(UserRoleAssignment(user_id=current_user.id, role=UserRole.ADMIN))
        await db.commit()

    return await _load_assignments(db, current_user.id)


@router.get("/me", response_model=AccessAssignmentsRead)
async def get_my_access(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return the calling user's own access assignments (any authenticated user)."""
    return await _load_assignments(db, current_user.id)


async def _ensure_user_exists(db: AsyncSession, user_id: UUID) -> User:
    user = await UserRepository(db).get(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def _load_assignments(db: AsyncSession, user_id: UUID) -> AccessAssignmentsRead:
    roles_result = await db.execute(
        select(UserRoleAssignment.role).where(UserRoleAssignment.user_id == user_id)
    )
    companies_result = await db.execute(
        select(UserCompanyAccess.company_id).where(UserCompanyAccess.user_id == user_id)
    )
    contracts_result = await db.execute(
        select(UserContractAccess.contract_id).where(UserContractAccess.user_id == user_id)
    )
    return AccessAssignmentsRead(
        user_id=user_id,
        roles=list(roles_result.scalars().all()),
        company_ids=list(companies_result.scalars().all()),
        contract_ids=list(contracts_result.scalars().all()),
    )


@router.get("/users/{user_id}", response_model=AccessAssignmentsRead)
async def get_access_assignments(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Any:
    await _ensure_user_exists(db, user_id)
    return await _load_assignments(db, user_id)


@router.put("/users/{user_id}/roles", response_model=AccessAssignmentsRead)
async def replace_user_roles(
    user_id: UUID,
    payload: RolesUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Any:
    await _ensure_user_exists(db, user_id)

    await db.execute(delete(UserRoleAssignment).where(UserRoleAssignment.user_id == user_id))
    for role in payload.roles:
        db.add(UserRoleAssignment(user_id=user_id, role=role))
    await db.commit()

    return await _load_assignments(db, user_id)


@router.put("/users/{user_id}/companies", response_model=AccessAssignmentsRead)
async def replace_user_company_scope(
    user_id: UUID,
    payload: ScopeUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Any:
    await _ensure_user_exists(db, user_id)

    await db.execute(delete(UserCompanyAccess).where(UserCompanyAccess.user_id == user_id))
    for company_id in payload.ids:
        db.add(UserCompanyAccess(user_id=user_id, company_id=company_id))
    await db.commit()

    return await _load_assignments(db, user_id)


@router.put("/users/{user_id}/contracts", response_model=AccessAssignmentsRead)
async def replace_user_contract_scope(
    user_id: UUID,
    payload: ScopeUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Any:
    await _ensure_user_exists(db, user_id)

    await db.execute(delete(UserContractAccess).where(UserContractAccess.user_id == user_id))
    for contract_id in payload.ids:
        db.add(UserContractAccess(user_id=user_id, contract_id=contract_id))
    await db.commit()

    return await _load_assignments(db, user_id)
