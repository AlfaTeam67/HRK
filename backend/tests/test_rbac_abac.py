from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import ProgrammingError

from app.core.database import AsyncSessionLocal
from app.models.company import Company
from app.models.customer import Customer
from app.models.enums import CustomerStatus, UserRole
from app.models.user import User
from app.models.user_company_access import UserCompanyAccess
from app.models.user_role import UserRoleAssignment


def _auth_headers(login: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {login}"}


async def _create_user(*, login: str, email: str) -> User:
    async with AsyncSessionLocal() as session:
        user = User(login=login, email=email)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def _create_company(*, name: str, nip: str) -> Company:
    async with AsyncSessionLocal() as session:
        company = Company(name=name, nip=nip, is_active=True)
        session.add(company)
        await session.commit()
        await session.refresh(company)
        return company


async def _create_customer(*, company_id: UUID, account_manager_id: UUID) -> Customer:
    async with AsyncSessionLocal() as session:
        customer = Customer(
            ckk=f"{uuid4().int % 10**10:010d}",
            company_id=company_id,
            account_manager_id=account_manager_id,
            status=CustomerStatus.ACTIVE,
        )
        session.add(customer)
        await session.commit()
        await session.refresh(customer)
        return customer


async def _assign_role(*, user_id: UUID, role: UserRole) -> None:
    async with AsyncSessionLocal() as session:
        try:
            session.add(UserRoleAssignment(user_id=user_id, role=role))
            await session.commit()
        except ProgrammingError as exc:
            await session.rollback()
            pytest.skip(f"user_roles table is unavailable in DB: {exc}")


async def _grant_company_scope(*, user_id: UUID, company_id: UUID) -> None:
    async with AsyncSessionLocal() as session:
        session.add(UserCompanyAccess(user_id=user_id, company_id=company_id))
        await session.commit()


@pytest.mark.asyncio
async def test_company_create_denies_non_admin(client: AsyncClient) -> None:
    user = await _create_user(login=f"viewer_{uuid4().hex[:8]}", email=f"{uuid4().hex[:8]}@hrk.eu")

    payload = {"name": f"Company {uuid4().hex[:6]}", "nip": f"{uuid4().int % 10**10:010d}"}
    response = await client.post(
        "/api/v1/companies/",
        json=payload,
        headers=_auth_headers(user.login),
    )

    assert response.status_code == 403
    detail = response.json().get("detail")
    assert isinstance(detail, dict)
    assert detail.get("code") == "AUTHORIZATION_DENIED"


@pytest.mark.asyncio
async def test_company_create_allows_admin(client: AsyncClient) -> None:
    admin = await _create_user(login=f"admin_{uuid4().hex[:8]}", email=f"{uuid4().hex[:8]}@hrk.eu")
    await _assign_role(user_id=admin.id, role=UserRole.ADMIN)

    payload = {
        "name": f"Admin Company {uuid4().hex[:6]}",
        "nip": f"{uuid4().int % 10**10:010d}",
        "is_active": True,
    }
    response = await client.post(
        "/api/v1/companies/",
        json=payload,
        headers=_auth_headers(admin.login),
    )

    assert response.status_code == 201


@pytest.mark.asyncio
async def test_company_list_returns_only_scoped_companies_for_non_admin(client: AsyncClient) -> None:
    user = await _create_user(login=f"scoped_{uuid4().hex[:8]}", email=f"{uuid4().hex[:8]}@hrk.eu")
    await _assign_role(user_id=user.id, role=UserRole.VIEWER)
    allowed_company = await _create_company(
        name=f"Allowed {uuid4().hex[:6]}",
        nip=f"{uuid4().int % 10**10:010d}",
    )
    denied_company = await _create_company(
        name=f"Denied {uuid4().hex[:6]}",
        nip=f"{uuid4().int % 10**10:010d}",
    )
    await _grant_company_scope(user_id=user.id, company_id=allowed_company.id)

    response = await client.get("/api/v1/companies/", headers=_auth_headers(user.login))

    assert response.status_code == 200
    ids = {item["id"] for item in response.json().get("items", [])}
    assert str(allowed_company.id) in ids
    assert str(denied_company.id) not in ids


@pytest.mark.asyncio
async def test_rag_search_denies_without_scope(client: AsyncClient) -> None:
    requester = await _create_user(
        login=f"raguser_{uuid4().hex[:8]}",
        email=f"{uuid4().hex[:8]}@hrk.eu",
    )
    account_manager = await _create_user(
        login=f"manager_{uuid4().hex[:8]}",
        email=f"{uuid4().hex[:8]}@hrk.eu",
    )
    company = await _create_company(
        name=f"Rag Scope {uuid4().hex[:6]}",
        nip=f"{uuid4().int % 10**10:010d}",
    )
    customer = await _create_customer(
        company_id=company.id,
        account_manager_id=account_manager.id,
    )

    response = await client.post(
        "/api/v1/rag/search",
        json={
            "customer_id": str(customer.id),
            "query": "Czy jest umowa?",
            "ai_mode": False,
            "top_k": 3,
        },
        headers=_auth_headers(requester.login),
    )

    assert response.status_code == 403
    detail = response.json().get("detail")
    assert isinstance(detail, dict)
    assert detail.get("code") == "AUTHORIZATION_DENIED"


@pytest.mark.asyncio
async def test_access_me_returns_roles_and_companies(client: AsyncClient) -> None:
    user = await _create_user(login=f"me_user_{uuid4().hex[:8]}", email=f"{uuid4().hex[:8]}@hrk.eu")
    await _assign_role(user_id=user.id, role=UserRole.VIEWER)
    company = await _create_company(name=f"MeCo {uuid4().hex[:6]}", nip=f"{uuid4().int % 10**10:010d}")
    await _grant_company_scope(user_id=user.id, company_id=company.id)

    response = await client.get("/api/v1/access/me", headers=_auth_headers(user.login))

    assert response.status_code == 200
    body = response.json()
    assert "viewer" in body.get("roles", [])
    assert str(company.id) in body.get("company_ids", [])


@pytest.mark.asyncio
async def test_access_user_scope_update_allows_admin_only(client: AsyncClient) -> None:
    admin = await _create_user(login=f"scope_admin_{uuid4().hex[:8]}", email=f"{uuid4().hex[:8]}@hrk.eu")
    target = await _create_user(login=f"scope_target_{uuid4().hex[:8]}", email=f"{uuid4().hex[:8]}@hrk.eu")
    await _assign_role(user_id=admin.id, role=UserRole.ADMIN)
    company = await _create_company(name=f"ScopeCo {uuid4().hex[:6]}", nip=f"{uuid4().int % 10**10:010d}")

    denied = await client.put(
        f"/api/v1/access/users/{target.id}/companies",
        json={"ids": [str(company.id)]},
        headers=_auth_headers(target.login),
    )
    assert denied.status_code == 403

    allowed = await client.put(
        f"/api/v1/access/users/{target.id}/companies",
        json={"ids": [str(company.id)]},
        headers=_auth_headers(admin.login),
    )
    assert allowed.status_code == 200
    assert str(company.id) in allowed.json().get("company_ids", [])
