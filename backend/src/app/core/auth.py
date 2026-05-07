"""Authentication and authorization helpers for FastAPI."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import TYPE_CHECKING, Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.models.user_company_access import UserCompanyAccess
from app.models.user_contract_access import UserContractAccess
from app.models.user_role import UserRoleAssignment
from app.repo.user import UserRepository

if TYPE_CHECKING:
    pass

bearer_scheme = HTTPBearer()


async def get_current_user(
    token: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency: returns current authenticated User.

    Token is expected to be the user's login (simplified for MVP).
    In production replace with JWT/session validation.
    """
    # For MVP we use login as token (simplified).
    # In real scenario decode JWT and get user id/login.
    login = token.credentials
    if not login:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
    repo = UserRepository(db)
    user = await repo.get_by_login(login)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


class AuthorizationService:
    """Central policy guard implementing RBAC + ABAC."""

    POLICY_MATRIX: dict[str, dict[str, UserRole]] = {
        "company": {
            "read": UserRole.VIEWER,
            "list": UserRole.VIEWER,
            "create": UserRole.ADMIN,
            "update": UserRole.MANAGER,
            "delete": UserRole.MANAGER,
        },
        "customer": {
            "read": UserRole.VIEWER,
            "list": UserRole.VIEWER,
            "create": UserRole.CONSULTANT,
            "update": UserRole.MANAGER,
            "delete": UserRole.MANAGER,
        },
        "contract": {
            "read": UserRole.VIEWER,
            "list": UserRole.VIEWER,
            "create": UserRole.CONSULTANT,
            "update": UserRole.MANAGER,
            "delete": UserRole.MANAGER,
        },
        "service": {
            "read": UserRole.VIEWER,
            "list": UserRole.VIEWER,
            "create": UserRole.MANAGER,
            "update": UserRole.MANAGER,
            "delete": UserRole.MANAGER,
        },
        "rate": {
            "read": UserRole.VIEWER,
            "list": UserRole.VIEWER,
            "create": UserRole.CONSULTANT,
            "update": UserRole.MANAGER,
            "delete": UserRole.MANAGER,
        },
        "valorization": {
            "read": UserRole.VIEWER,
            "list": UserRole.VIEWER,
            "create": UserRole.MANAGER,
            "update": UserRole.MANAGER,
            "delete": UserRole.MANAGER,
        },
        "document": {
            "read": UserRole.VIEWER,
            "upload": UserRole.CONSULTANT,
            "delete": UserRole.MANAGER,
        },
        "note": {
            "read": UserRole.VIEWER,
            "list": UserRole.VIEWER,
            "create": UserRole.CONSULTANT,
            "update": UserRole.CONSULTANT,
            "delete": UserRole.MANAGER,
        },
        "contact_person": {
            "read": UserRole.VIEWER,
            "list": UserRole.VIEWER,
            "create": UserRole.CONSULTANT,
            "update": UserRole.CONSULTANT,
            "delete": UserRole.MANAGER,
        },
        "activity": {
            "read": UserRole.VIEWER,
            "list": UserRole.VIEWER,
            "create": UserRole.CONSULTANT,
        },
        "rag": {
            "query": UserRole.VIEWER,
        },
        "access": {
            "manage": UserRole.ADMIN,
        },
        "user": {
            "manage": UserRole.ADMIN,
        },
    }

    _ROLE_RANK: dict[UserRole, int] = {
        UserRole.VIEWER: 1,
        UserRole.CONSULTANT: 2,
        UserRole.MANAGER: 3,
        UserRole.ACCOUNT_MANAGER: 3,
        UserRole.ADMIN: 4,
    }

    _ACTION_TO_MIN_ROLE: dict[str, UserRole] = {
        "read": UserRole.VIEWER,
        "list": UserRole.VIEWER,
        "create": UserRole.CONSULTANT,
        "write": UserRole.CONSULTANT,
        "delete": UserRole.MANAGER,
        "update": UserRole.MANAGER,
        "upload": UserRole.CONSULTANT,
        "query": UserRole.VIEWER,
        "manage": UserRole.ADMIN,
    }

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def authorize(
        self,
        *,
        user: User,
        action: str,
        resource_company_id: uuid.UUID | None = None,
        resource_contract_id: uuid.UUID | None = None,
    ) -> None:
        min_role = self._ACTION_TO_MIN_ROLE.get(action)
        if min_role is None:
            raise PermissionError("Unknown action.")

        await self._authorize_with_min_role(
            user=user,
            min_role=min_role,
            resource_company_id=resource_company_id,
            resource_contract_id=resource_contract_id,
        )

    async def authorize_by_policy(
        self,
        *,
        user: User,
        resource: str,
        action: str,
        resource_company_id: uuid.UUID | None = None,
        resource_contract_id: uuid.UUID | None = None,
        allow_role_only: bool = False,
    ) -> None:
        resource_policy = self.POLICY_MATRIX.get(resource)
        if resource_policy is None or action not in resource_policy:
            raise PermissionError("Unknown policy action.")
        min_role = resource_policy[action]
        await self._authorize_with_min_role(
            user=user,
            min_role=min_role,
            resource_company_id=resource_company_id,
            resource_contract_id=resource_contract_id,
            allow_role_only=allow_role_only,
        )

    async def ensure_min_role(self, *, user: User, min_role: UserRole) -> None:
        roles = await self.get_user_roles(user.id)
        highest_rank = max((self._ROLE_RANK[role] for role in roles), default=0)
        if highest_rank < self._ROLE_RANK[min_role]:
            raise PermissionError("Insufficient role for requested action.")

    def get_policy_min_role(self, *, resource: str, action: str) -> UserRole:
        resource_policy = self.POLICY_MATRIX.get(resource)
        if resource_policy is None or action not in resource_policy:
            raise PermissionError("Unknown policy action.")
        return resource_policy[action]

    async def _get_user_roles(self, user: User) -> set[UserRole]:
        return await self.get_user_roles(user.id)

    async def get_user_roles(self, user_id: uuid.UUID) -> set[UserRole]:
        try:
            result = await self._db.execute(
                select(UserRoleAssignment.role).where(UserRoleAssignment.user_id == user_id)
            )
            assigned_roles = set(result.scalars().all())
        except ProgrammingError:
            return {UserRole.VIEWER}

        if assigned_roles:
            return assigned_roles

        return {UserRole.VIEWER}

    async def _has_scope(
        self,
        *,
        user_id: uuid.UUID,
        company_id: uuid.UUID | None,
        contract_id: uuid.UUID | None,
    ) -> bool:
        has_company_scope = False
        has_contract_scope = False

        if company_id is not None:
            company_result = await self._db.execute(
                select(UserCompanyAccess.user_id)
                .where(UserCompanyAccess.user_id == user_id)
                .where(UserCompanyAccess.company_id == company_id)
                .limit(1)
            )
            has_company_scope = company_result.scalar_one_or_none() is not None

        if contract_id is not None:
            contract_result = await self._db.execute(
                select(UserContractAccess.user_id)
                .where(UserContractAccess.user_id == user_id)
                .where(UserContractAccess.contract_id == contract_id)
                .limit(1)
            )
            has_contract_scope = contract_result.scalar_one_or_none() is not None

        return has_company_scope or has_contract_scope

    async def get_user_company_scope(self, user_id: uuid.UUID) -> set[uuid.UUID]:
        result = await self._db.execute(
            select(UserCompanyAccess.company_id).where(UserCompanyAccess.user_id == user_id)
        )
        return set(result.scalars().all())

    async def get_user_contract_scope(self, user_id: uuid.UUID) -> set[uuid.UUID]:
        result = await self._db.execute(
            select(UserContractAccess.contract_id).where(UserContractAccess.user_id == user_id)
        )
        return set(result.scalars().all())

    async def _authorize_with_min_role(
        self,
        *,
        user: User,
        min_role: UserRole,
        resource_company_id: uuid.UUID | None = None,
        resource_contract_id: uuid.UUID | None = None,
        allow_role_only: bool = False,
    ) -> None:
        roles = await self._get_user_roles(user)
        if UserRole.ADMIN in roles:
            return

        if not allow_role_only:
            has_scope = await self._has_scope(
                user_id=user.id,
                company_id=resource_company_id,
                contract_id=resource_contract_id,
            )
            if not has_scope:
                raise PermissionError("Access denied: user has no scope for requested resource.")
        else:
            company_scope = await self.get_user_company_scope(user.id)
            contract_scope = await self.get_user_contract_scope(user.id)
            if not company_scope and not contract_scope:
                raise PermissionError("Access denied: user has no scope for requested resource.")

        highest_rank = max((self._ROLE_RANK[role] for role in roles), default=0)
        if highest_rank < self._ROLE_RANK[min_role]:
            raise PermissionError("Insufficient role for requested action.")

    @staticmethod
    def get_current_user_dep() -> Callable[..., object]:
        return get_current_user


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> User:
    service = AuthorizationService(db)
    try:
        await service.ensure_min_role(user=current_user, min_role=UserRole.ADMIN)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "AUTHORIZATION_DENIED", "message": str(exc)},
        ) from exc
    return current_user
