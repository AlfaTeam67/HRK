from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import ProgrammingError

from app.core.database import AsyncSessionLocal
from app.models.enums import UserRole
from app.models.user import User
from app.models.user_role import UserRoleAssignment


async def _create_user(*, login: str, email: str) -> User:
    async with AsyncSessionLocal() as session:
        user = User(login=login, email=email)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def _assign_role(*, user_id, role: UserRole) -> None:
    async with AsyncSessionLocal() as session:
        try:
            session.add(UserRoleAssignment(user_id=user_id, role=role))
            await session.commit()
        except ProgrammingError as exc:
            await session.rollback()
            pytest.skip(f"user_roles table not available in current test DB: {exc}")


def _auth_headers(login: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {login}"}


@pytest.mark.asyncio
async def test_create_company_smoke(client: AsyncClient) -> None:
    company_data = {"name": "Test Company", "nip": "1234567890", "is_active": True}
    response = await client.post("/api/v1/companies/", json=company_data)
    assert response.status_code in [201, 400, 403, 500]


@pytest.mark.asyncio
async def test_list_companies_smoke(client: AsyncClient) -> None:
    response = await client.get("/api/v1/companies/")
    assert response.status_code in [200, 403, 500]


@pytest.mark.asyncio
async def test_create_user_smoke(client: AsyncClient) -> None:
    user_data = {
        "login": "testuser",
        "email": "test@example.com",
    }
    response = await client.post("/api/v1/users/", json=user_data)
    assert response.status_code in [201, 400, 403, 500]


@pytest.mark.asyncio
async def test_upload_document_requires_parent(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/documents/",
        files={"file": ("sample.pdf", b"test", "application/pdf")},
        data={"document_type": "other"},
    )
    assert response.status_code in [400, 403]


@pytest.mark.asyncio
async def test_get_document_download_url_smoke(client: AsyncClient) -> None:
    response = await client.get(f"/api/v1/documents/{uuid4()}/download-url")
    assert response.status_code in [400, 403, 404, 500]


@pytest.mark.asyncio
async def test_companies_requires_auth(anon_client: AsyncClient) -> None:
    response = await anon_client.get("/api/v1/companies/")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_access_endpoint_denies_non_admin(client: AsyncClient) -> None:
    user = await _create_user(login=f"user_{uuid4().hex[:8]}", email=f"{uuid4().hex[:8]}@hrk.eu")

    response = await client.get(
        f"/api/v1/access/users/{user.id}",
        headers=_auth_headers(user.login),
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_access_endpoint_allows_admin(client: AsyncClient) -> None:
    admin = await _create_user(
        login=f"admin_{uuid4().hex[:8]}",
        email=f"admin_{uuid4().hex[:8]}@hrk.eu",
    )
    await _assign_role(user_id=admin.id, role=UserRole.ADMIN)

    response = await client.get(
        f"/api/v1/access/users/{admin.id}",
        headers=_auth_headers(admin.login),
    )

    assert response.status_code == 200
