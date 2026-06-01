"""API tests for Reports endpoint."""

import uuid
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import main as main_module
from app.main import app
from app.models.enums import ActivityType
from app.service.reports import ReportsService

_ADMIN_USER_ID = uuid.uuid4()
_WORKER_USER_ID = uuid.uuid4()

_FAKE_KPI = SimpleNamespace(events_count=5, meetings_count=2, documents_count=1, notes_count=2)

_FAKE_ITEM = SimpleNamespace(
    id=uuid.uuid4(),
    customer_id=None,
    contract_id=None,
    activity_type=ActivityType.MEETING,
    description="Test meeting",
    performed_by=_ADMIN_USER_ID,
    performed_by_login="admin",
    activity_date="2026-06-01T10:00:00Z",
    additional_data={},
    is_own=True,
)


class FakeReportsService:
    async def get_activity_report(self, **kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(
            items=[_FAKE_ITEM],
            kpi=_FAKE_KPI,
            total=1,
        )


class _DummyStorageService:
    async def ensure_bucket_private(self) -> None:
        return None


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(main_module, "get_storage_service", lambda: _DummyStorageService())
    from app.api.v1.reports import get_reports_service
    app.dependency_overrides[get_reports_service] = lambda: FakeReportsService()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_reports_activity_requires_current_user_id(client: TestClient) -> None:
    response = client.get("/api/v1/reports/activity")
    assert response.status_code == 422


def test_reports_activity_returns_structure(client: TestClient) -> None:
    response = client.get(
        "/api/v1/reports/activity",
        params={"current_user_id": str(_ADMIN_USER_ID)},
    )
    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert "kpi" in body
    assert "total" in body
    assert body["total"] == 1
    assert body["kpi"]["events_count"] == 5
    assert body["items"][0]["is_own"] is True


def test_reports_activity_default_period(client: TestClient) -> None:
    response = client.get(
        "/api/v1/reports/activity",
        params={"current_user_id": str(_ADMIN_USER_ID), "period": 30},
    )
    assert response.status_code == 200


def test_openapi_contains_reports_path(client: TestClient) -> None:
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/reports/activity" in paths
