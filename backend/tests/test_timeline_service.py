"""Unit tests for customer timeline service."""

import uuid
from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.models.enums import ActivityType, ValorizationStatus
from app.service.timeline import TimelineService


class FakeTimelineRepo:
    def __init__(self, *, contracts, valorizations, notes, activities, alerts) -> None:
        self._contracts = contracts
        self._valorizations = valorizations
        self._notes = notes
        self._activities = activities
        self._alerts = alerts

    async def list_contracts(self, customer_id):
        return self._contracts

    async def list_valorizations(self, contract_ids):
        return self._valorizations

    async def list_notes(self, customer_id, contract_ids):
        return self._notes

    async def list_activity_logs(self, customer_id):
        return self._activities

    async def list_alerts(self, customer_id, contract_ids):
        return self._alerts


@pytest.mark.asyncio
async def test_timeline_sorted_desc_by_timestamp() -> None:
    now = datetime.now(UTC)
    contract_id = uuid.uuid4()
    contract = SimpleNamespace(
        id=contract_id,
        contract_number="HRK/EMP/2024/01",
        start_date=date.today() - timedelta(days=10),
        status="active",
    )
    valorization = SimpleNamespace(
        id=uuid.uuid4(),
        contract_id=contract_id,
        year=2025,
        planned_date=date.today() - timedelta(days=5),
        applied_date=date.today() - timedelta(days=2),
        status=ValorizationStatus.APPROVED,
        notes=None,
        index_type="GUS_CPI",
        index_value=5.8,
    )
    note = SimpleNamespace(
        id=uuid.uuid4(),
        created_at=now - timedelta(days=1),
        content="Notatka",
        created_by=None,
        contract_id=contract_id,
        note_type="meeting",
    )
    activity = SimpleNamespace(
        id=uuid.uuid4(),
        activity_date=now,
        activity_type=ActivityType.MEETING,
        description="Spotkanie",
        performed_by=None,
        contract_id=contract_id,
        additional_data={},
    )
    repo = FakeTimelineRepo(
        contracts=[contract],
        valorizations=[valorization],
        notes=[note],
        activities=[activity],
        alerts=[],
    )
    service = TimelineService(repo)

    events = await service.get_timeline(
        customer_id=uuid.uuid4(),
        from_date=None,
        to_date=None,
        event_types=None,
    )

    assert events
    assert events[0].title == "Spotkanie"
    assert events[0].timestamp == now
    assert events == sorted(events, key=lambda event: event.timestamp, reverse=True)


@pytest.mark.asyncio
async def test_timeline_filters_event_types() -> None:
    activity = SimpleNamespace(
        id=uuid.uuid4(),
        activity_date=datetime.now(UTC),
        activity_type=ActivityType.MEETING,
        description="Spotkanie",
        performed_by=None,
        contract_id=None,
        additional_data={},
    )
    note = SimpleNamespace(
        id=uuid.uuid4(),
        created_at=datetime.now(UTC) - timedelta(days=1),
        content="Notatka",
        created_by=None,
        contract_id=None,
        note_type="internal",
    )
    repo = FakeTimelineRepo(
        contracts=[],
        valorizations=[],
        notes=[note],
        activities=[activity],
        alerts=[],
    )
    service = TimelineService(repo)

    events = await service.get_timeline(
        customer_id=uuid.uuid4(),
        from_date=None,
        to_date=None,
        event_types={"meeting"},
    )

    assert len(events) == 1
    assert events[0].event_type == "meeting"


@pytest.mark.asyncio
async def test_timeline_maps_activity_types() -> None:
    activities = [
        SimpleNamespace(
            id=uuid.uuid4(),
            activity_date=datetime.now(UTC),
            activity_type=ActivityType.CALL,
            description="Call",
            performed_by=None,
            contract_id=None,
            additional_data={},
        ),
        SimpleNamespace(
            id=uuid.uuid4(),
            activity_date=datetime.now(UTC),
            activity_type=ActivityType.EMAIL,
            description="Email",
            performed_by=None,
            contract_id=None,
            additional_data={},
        ),
    ]
    repo = FakeTimelineRepo(
        contracts=[],
        valorizations=[],
        notes=[],
        activities=activities,
        alerts=[],
    )
    service = TimelineService(repo)

    events = await service.get_timeline(
        customer_id=uuid.uuid4(),
        from_date=None,
        to_date=None,
        event_types=None,
    )

    event_types = {event.event_type for event in events}
    assert "call" in event_types
    assert "email" in event_types
