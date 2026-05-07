import uuid
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.auth import AuthorizationService
from app.core.database import AsyncSessionLocal
from app.models.company import Company
from app.models.contract import Contract
from app.models.customer import Customer
from app.models.enums import ContractStatus, ContractType, CustomerStatus, UserRole
from app.models.user import User
from app.models.user_company_access import UserCompanyAccess
from app.models.user_contract_access import UserContractAccess
from app.models.user_role import UserRoleAssignment


def _auth_headers(login: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {login}"}


async def _create_test_user(login: str, role: UserRole | None = None) -> User:
    async with AsyncSessionLocal() as session:
        user = User(login=login, email=f"{login}@example.com")
        session.add(user)
        await session.commit()
        await session.refresh(user)

        if role:
            session.add(UserRoleAssignment(user_id=user.id, role=role))
            await session.commit()
        return user


async def _create_test_company(name: str) -> Company:
    async with AsyncSessionLocal() as session:
        company = Company(name=name, nip=f"{uuid.uuid4().int % 10**10:010d}", is_active=True)
        session.add(company)
        await session.commit()
        await session.refresh(company)
        return company


async def _create_test_contract(company_id: uuid.UUID, manager_id: uuid.UUID) -> Contract:
    async with AsyncSessionLocal() as session:
        customer = Customer(
            ckk=f"{uuid.uuid4().int % 10**10:010d}",
            company_id=company_id,
            account_manager_id=manager_id,
            status=CustomerStatus.ACTIVE,
        )
        session.add(customer)
        await session.flush()

        contract = Contract(
            customer_id=customer.id,
            contract_number=f"CONT-{uuid.uuid4().hex[:6]}",
            contract_type=ContractType.SLA,
            status=ContractStatus.ACTIVE,
            start_date=date.today(),
            account_manager_id=manager_id,
        )
        session.add(contract)
        await session.commit()
        await session.refresh(contract)
        return contract


@pytest.mark.asyncio
async def test_role_hierarchy_enforcement(client: AsyncClient):
    """Verify that Consultant can read but not delete, while Manager can delete."""
    suffix = uuid.uuid4().hex[:6]
    company = await _create_test_company(f"Hierarchy Test {suffix}")
    manager_user = await _create_test_user(f"manager_hier_{suffix}", role=UserRole.MANAGER)
    consultant_user = await _create_test_user(f"consultant_hier_{suffix}", role=UserRole.CONSULTANT)
    
    contract = await _create_test_contract(company.id, manager_user.id)

    # Grant both users scope to the company
    async with AsyncSessionLocal() as session:
        session.add(UserCompanyAccess(user_id=manager_user.id, company_id=company.id))
        session.add(UserCompanyAccess(user_id=consultant_user.id, company_id=company.id))
        await session.commit()

    # Consultant tries to delete (should fail)
    del_cons = await client.delete(f"/api/v1/contracts/{contract.id}", headers=_auth_headers(consultant_user.login))
    assert del_cons.status_code == 403
    assert del_cons.json()["detail"]["code"] == "AUTHORIZATION_DENIED"

    # Manager tries to delete (should succeed)
    del_mgr = await client.delete(f"/api/v1/contracts/{contract.id}", headers=_auth_headers(manager_user.login))
    assert del_mgr.status_code == 204


@pytest.mark.asyncio
async def test_abac_scope_isolation(client: AsyncClient):
    """Verify that user with Manager role but no scope to Company B is denied."""
    suffix = uuid.uuid4().hex[:6]
    company_a = await _create_test_company(f"Company A {suffix}")
    company_b = await _create_test_company(f"Company B {suffix}")
    manager = await _create_test_user(f"mgr_scoped_{suffix}", role=UserRole.MANAGER)
    
    # Grant scope only to Company A
    async with AsyncSessionLocal() as session:
        session.add(UserCompanyAccess(user_id=manager.id, company_id=company_a.id))
        await session.commit()

    # Create resource in Company B
    contract_b = await _create_test_contract(company_b.id, manager.id)

    # Manager tries to read contract from Company B (denied by scope)
    resp = await client.get(f"/api/v1/contracts/{contract_b.id}", headers=_auth_headers(manager.login))
    assert resp.status_code == 403
    assert "scope" in resp.json()["detail"]["message"].lower()


@pytest.mark.asyncio
async def test_contract_specific_scope(client: AsyncClient):
    """Verify that user with no company scope but specific contract scope is allowed."""
    suffix = uuid.uuid4().hex[:6]
    company = await _create_test_company(f"Contract Scope Test {suffix}")
    viewer = await _create_test_user(f"viewer_contract_{suffix}", role=UserRole.VIEWER)
    contract = await _create_test_contract(company.id, viewer.id)

    # NO company scope, only CONTRACT scope
    async with AsyncSessionLocal() as session:
        session.add(UserContractAccess(user_id=viewer.id, contract_id=contract.id))
        await session.commit()

    # Should be allowed to read THIS contract
    resp = await client.get(f"/api/v1/contracts/{contract.id}", headers=_auth_headers(viewer.login))
    assert resp.status_code == 200
    assert resp.json()["id"] == str(contract.id)


@pytest.mark.asyncio
async def test_admin_bypass_all_scopes(client: AsyncClient):
    """Verify that Admin can see resources regardless of scope."""
    suffix = uuid.uuid4().hex[:6]
    company = await _create_test_company(f"Admin Bypass Test {suffix}")
    admin = await _create_test_user(f"admin_bypass_{suffix}", role=UserRole.ADMIN)
    contract = await _create_test_contract(company.id, admin.id)

    # NO scope records for admin
    
    resp = await client.get(f"/api/v1/contracts/{contract.id}", headers=_auth_headers(admin.login))
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_default_role_is_viewer(client: AsyncClient):
    """Verify that user with no roles in DB defaults to Viewer."""
    suffix = uuid.uuid4().hex[:6]
    company = await _create_test_company(f"Default Role Test {suffix}")
    user_no_role = await _create_test_user(f"no_role_user_{suffix}") # No role assigned
    contract = await _create_test_contract(company.id, user_no_role.id)

    # Grant scope so we can test the role part
    async with AsyncSessionLocal() as session:
        session.add(UserCompanyAccess(user_id=user_no_role.id, company_id=company.id))
        await session.commit()

    # Should be able to read (Viewer)
    resp_read = await client.get(f"/api/v1/contracts/{contract.id}", headers=_auth_headers(user_no_role.login))
    assert resp_read.status_code == 200

    # Should NOT be able to delete (requires Manager)
    resp_del = await client.delete(f"/api/v1/contracts/{contract.id}", headers=_auth_headers(user_no_role.login))
    assert resp_del.status_code == 403
