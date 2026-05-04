"""API tests for ActivityLog endpoints."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import main as main_module
from app.api.deps import get_crm_service
from app.core.auth import get_current_user
from app.main import app
from app.models.enums import ActivityType


class FakeActivityCRMService:
    """In-memory CRM service subset used for activity log API tests."""

    def __init__(self) -> None:
        self.customer_id = uuid.uuid4()
        self.contract_id = uuid.uuid4()
        self.user_id = uuid.uuid4()
        self._activities: list[dict[str, object]] = []

    async def list_activity_logs(
        self,
        *,
        customer_id: uuid.UUID | None,
        contract_id: uuid.UUID | None,
        limit: int,
        offset: int,
    ) -> list[SimpleNamespace]:
        if customer_id is None and contract_id is None:
            raise HTTPException(status_code=422, detail="Either customer_id or contract_id must be provided")
        if customer_id is not None and contract_id is not None:
            raise HTTPException(status_code=422, detail="Only one of customer_id or contract_id can be provided")

        if customer_id is not None:
            if customer_id != self.customer_id:
                raise HTTPException(status_code=404, detail="Customer not found")
            items = [item for item in self._activities if item["customer_id"] == customer_id]
        else:
            if contract_id != self.contract_id:
                raise HTTPException(status_code=404, detail="Contract not found")
            items = [item for item in self._activities if item["contract_id"] == contract_id]

        return [SimpleNamespace(**item) for item in items[offset : offset + limit]]

    async def create_activity_log(
        self,
        payload,
        *,
        performed_by: uuid.UUID | None,
    ) -> SimpleNamespace:
        if payload.customer_id is None and payload.contract_id is None:
            raise HTTPException(
                status_code=422,
                detail="At least one of customer_id or contract_id must be provided",
            )

        if payload.customer_id and payload.customer_id != self.customer_id:
            raise HTTPException(status_code=404, detail="Customer not found")
        if payload.contract_id and payload.contract_id != self.contract_id:
            raise HTTPException(status_code=404, detail="Contract not found")
        if performed_by and performed_by != self.user_id:
            raise HTTPException(status_code=404, detail="User not found")

        now = datetime.now(UTC)
        activity = {
            "id": uuid.uuid4(),
            "customer_id": payload.customer_id or self.customer_id,
            "contract_id": payload.contract_id,
            "activity_type": payload.activity_type,
            "description": payload.description,
            "performed_by": performed_by,
            "activity_date": payload.activity_date,
            "additional_data": payload.additional_data,
            "created_at": now,
        }
        self._activities.append(activity)
        return SimpleNamespace(**activity)


class _DummyStorageService:
    async def ensure_bucket_private(self) -> None:
        return None


@pytest.fixture
def fake_activity_service() -> FakeActivityCRMService:
    return FakeActivityCRMService()


@pytest.fixture
def client(fake_activity_service: FakeActivityCRMService, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(main_module, "get_storage_service", lambda: _DummyStorageService())
    app.dependency_overrides[get_crm_service] = lambda: fake_activity_service
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=fake_activity_service.user_id)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_activity_log_create_and_list_for_customer(
    client: TestClient,
    fake_activity_service: FakeActivityCRMService,
) -> None:
    response = client.post(
        "/api/v1/activity-log",
        json={
            "customer_id": str(fake_activity_service.customer_id),
            "activity_type": ActivityType.MEETING.value,
            "description": "Quarterly business review",
            "additional_data": {"channel": "onsite"},
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["customer_id"] == str(fake_activity_service.customer_id)
    assert body["activity_type"] == ActivityType.MEETING.value
    assert body["performed_by"] is None

    list_response = client.get(
        "/api/v1/activity-log",
        params={"customer_id": str(fake_activity_service.customer_id)},
    )
    assert list_response.status_code == 200
    listed = list_response.json()
    assert len(listed) == 1
    assert listed[0]["description"] == "Quarterly business review"


def test_activity_log_list_for_contract(client: TestClient, fake_activity_service: FakeActivityCRMService) -> None:
    create_response = client.post(
        "/api/v1/activity-log",
        json={
            "contract_id": str(fake_activity_service.contract_id),
            "activity_type": ActivityType.CALL.value,
            "description": "Follow-up call",
            "additional_data": {"duration_minutes": 30},
        },
    )
    assert create_response.status_code == 201

    list_response = client.get(
        "/api/v1/activity-log",
        params={"contract_id": str(fake_activity_service.contract_id)},
    )
    assert list_response.status_code == 200
    listed = list_response.json()
    assert len(listed) == 1
    assert listed[0]["activity_type"] == ActivityType.CALL.value


def test_activity_log_requires_single_filter(client: TestClient, fake_activity_service: FakeActivityCRMService) -> None:
    none_response = client.get("/api/v1/activity-log")
    assert none_response.status_code == 422

    both_response = client.get(
        "/api/v1/activity-log",
        params={
            "customer_id": str(fake_activity_service.customer_id),
            "contract_id": str(fake_activity_service.contract_id),
        },
    )
    assert both_response.status_code == 422


def test_openapi_contains_activity_log_paths(client: TestClient) -> None:
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/activity-log" in paths
