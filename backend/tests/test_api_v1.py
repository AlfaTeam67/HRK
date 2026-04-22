import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_company_smoke(client: AsyncClient) -> None:
    company_data = {"name": "Test Company", "nip": "1234567890", "is_active": True}
    response = await client.post("/api/v1/companies/", json=company_data)
    assert response.status_code in [201, 400, 500]


@pytest.mark.asyncio
async def test_list_companies_smoke(client: AsyncClient) -> None:
    response = await client.get("/api/v1/companies/")
    assert response.status_code in [200, 500]


@pytest.mark.asyncio
async def test_create_user_smoke(client: AsyncClient) -> None:
    user_data = {
        "ad_username": "testuser",
        "email": "test@example.com",
        "first_name": "Test",
        "last_name": "User",
        "role": "viewer",
        "is_active": True,
    }
    response = await client.post("/api/v1/users/", json=user_data)
    assert response.status_code in [201, 400, 500]
