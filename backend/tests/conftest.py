"""Pytest configuration for backend tests."""

import asyncio
import os
from collections.abc import AsyncGenerator, Generator

import pytest
from httpx import ASGITransport, AsyncClient

# Required settings consumed at import time by app.config.Settings.
database_url = os.getenv("DATABASE_URL")
if not database_url:
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as env_file:
            for line in env_file:
                if line.startswith("DATABASE_URL="):
                    database_url = line.strip().split("=", 1)[1]
                    break

if database_url and "@db:" in database_url:
    os.environ["DATABASE_URL"] = database_url.replace("@db:", "@localhost:")
elif database_url:
    os.environ["DATABASE_URL"] = database_url
elif not database_url:
    pg_user = os.getenv("POSTGRES_USER", "hrk")
    pg_password = os.getenv("POSTGRES_PASSWORD", "hrk_secret")
    pg_db = os.getenv("POSTGRES_DB", "hrk_db")
    os.environ["DATABASE_URL"] = (
        f"postgresql+asyncpg://{pg_user}:{pg_password}@localhost:5432/{pg_db}"
    )

os.environ.setdefault("S3_ACCESS_KEY", "test")
os.environ.setdefault("S3_SECRET_KEY", "test")
os.environ.setdefault("S3_REQUIRE_PRIVATE_BUCKET", "false")
os.environ.setdefault("DEBUG", "true")

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    admin_login = "test_admin"
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        await ac.post(f"/api/v1/auth/login/{admin_login}")
        ac.headers["Authorization"] = f"Bearer {admin_login}"
        yield ac


@pytest.fixture
async def anon_client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
