"""Pytest configuration for backend tests."""

import os
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

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

# NullPool: no connection is reused across async contexts, so per-test event
# loops can each open and close their own connections without cross-loop issues.
import app.core.database as _db_module  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.ad import ADUserRead  # noqa: E402

_test_engine = create_async_engine(
    os.environ["DATABASE_URL"],
    echo=_db_module.engine.echo,
    future=True,
    poolclass=NullPool,
)
_test_session_factory = async_sessionmaker(
    bind=_test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)
_db_module.engine = _test_engine
_db_module.AsyncSessionLocal = _test_session_factory


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    login = "test_user"
    fake_ad_user = ADUserRead(identity=login, groups=[])
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch(
            "app.service.ad_login.ADLoginService._fetch_ad_user",
            new_callable=AsyncMock,
            return_value=fake_ad_user,
        ):
            await ac.post(f"/api/v1/auth/login/{login}")
        ac.headers["Authorization"] = f"Bearer {login}"
        yield ac


@pytest.fixture
async def anon_client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
