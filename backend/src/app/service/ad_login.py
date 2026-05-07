from __future__ import annotations

import asyncio
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import HTTPException, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.enums import UserRole
from app.models.user_role import UserRoleAssignment
from app.repo.user import UserRepository
from app.schemas.ad import ADUserRead
from app.schemas.user import UserRead

# Map of lowercase keywords found in AD group names → role.
# Checked in order — first match wins. Add/change via env if needed.
_GROUP_ROLE_MAP: list[tuple[str, UserRole]] = [
    ("admin", UserRole.ADMIN),
    ("account_manager", UserRole.ACCOUNT_MANAGER),
    ("manager", UserRole.MANAGER),
    ("consultant", UserRole.CONSULTANT),
    ("konsultant", UserRole.CONSULTANT),
]


class ADLoginService:
    def __init__(self) -> None:
        self._base_url = settings.ad_service_url.rstrip("/")

    async def login(self, username: str, db: AsyncSession) -> UserRead:
        ad_user = await self._fetch_ad_user(username)
        login = self._extract_login(ad_user.identity)
        roles = self._extract_roles(ad_user.groups)

        repo = UserRepository(db)
        existing_user = await repo.get_by_login(login)
        user = existing_user if existing_user else await repo.create(self._build_user_payload(login))

        await self._sync_roles(db, user.id, roles)

        return UserRead(
            id=user.id,
            login=user.login,
            email=user.email,
            roles=[r.value for r in roles],
        )

    def _extract_roles(self, groups: list[str]) -> set[UserRole]:
        roles: set[UserRole] = set()
        for group in groups:
            group_lower = group.lower()
            for keyword, role in _GROUP_ROLE_MAP:
                if keyword in group_lower:
                    roles.add(role)
                    break
        return roles or {UserRole.VIEWER}

    async def _sync_roles(self, db: AsyncSession, user_id: object, roles: set[UserRole]) -> None:
        from uuid import UUID
        uid = user_id if isinstance(user_id, UUID) else UUID(str(user_id))
        await db.execute(delete(UserRoleAssignment).where(UserRoleAssignment.user_id == uid))
        for role in roles:
            db.add(UserRoleAssignment(user_id=uid, role=role))

    async def _fetch_ad_user(self, username: str) -> ADUserRead:
        normalized_username = username.strip().replace("/", "\\")
        if "\\" in normalized_username:
            identity = normalized_username
        else:
            identity = f"{settings.api_ad_domain}\\{normalized_username}"
        url = f"{self._base_url}/ad/user"

        query = urlencode({"identity": identity})
        request = Request(f"{url}?{query}", headers={"Accept": "application/json"})

        try:
            response_body = await asyncio.to_thread(self._read_json_response, request)
        except HTTPError as exc:
            if exc.code == status.HTTP_404_NOT_FOUND:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found in AD",
                ) from exc

            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AD service is unavailable",
            ) from exc
        except URLError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AD service is unavailable",
            ) from exc

        return ADUserRead.model_validate(json.loads(response_body))

    def _read_json_response(self, request: Request) -> str:
        with urlopen(request, timeout=settings.ad_request_timeout) as response:  # nosec B310
            body: bytes = response.read()
            return body.decode("utf-8")

    def _build_user_payload(self, login: str) -> dict[str, object]:
        return {"login": login, "email": f"{login}@hrk.eu"}

    def _extract_login(self, identity: str) -> str:
        if "\\" in identity:
            return identity.split("\\", maxsplit=1)[1].strip()
        return identity.strip()
