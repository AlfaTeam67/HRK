from __future__ import annotations

import asyncio
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.repo.user import UserRepository
from app.schemas.ad import ADUserRead
from app.schemas.user import UserRead


class ADLoginService:
    def __init__(self) -> None:
        self._base_url = settings.ad_service_url.rstrip("/")

    async def login(self, username: str, db: AsyncSession) -> UserRead:
        ad_user = await self._fetch_ad_user(username)
        login = self._extract_login(ad_user.identity)
        repo = UserRepository(db)
        existing_user = await repo.get_by_login(login)

        if existing_user:
            return UserRead.model_validate(existing_user)

        user = await repo.create(self._build_user_payload(login))
        return UserRead.model_validate(user)

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
        with urlopen(request, timeout=settings.ad_request_timeout) as response:
            return response.read().decode("utf-8")

    def _build_user_payload(self, login: str) -> dict[str, object]:
        email = f"{login}@hrk.eu"

        return {
            "login": login,
            "email": email,
        }

    def _extract_login(self, identity: str) -> str:
        if "\\" in identity:
            return identity.split("\\", maxsplit=1)[1].strip()
        return identity.strip()
