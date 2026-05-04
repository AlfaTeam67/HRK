"""Customer timeline aggregation service."""

import uuid
from collections.abc import Iterable
from datetime import UTC, date, datetime

from app.models.activity import ActivityLog
from app.models.alert import Alert
from app.models.contract import Contract
from app.models.enums import ActivityType, ValorizationStatus
from app.models.note import Note
from app.models.rate import Valorization
from app.repo.timeline import TimelineRepository
from app.schemas.timeline import TimelineEventRead, TimelineEventType


class TimelineService:
    """Builds aggregated timeline events for a customer."""

    def __init__(self, repo: TimelineRepository) -> None:
        self.repo = repo

    async def get_timeline(
        self,
        customer_id: uuid.UUID,
        *,
        from_date: datetime | None,
        to_date: datetime | None,
        event_types: set[TimelineEventType] | None,
        limit: int = 100,
    ) -> list[TimelineEventRead]:
        contracts = await self.repo.list_contracts(customer_id)
        contract_ids = [contract.id for contract in contracts]
        valorizations = await self.repo.list_valorizations(contract_ids)
        notes = await self.repo.list_notes(customer_id, contract_ids)
        activities = await self.repo.list_activity_logs(customer_id)
        alerts = await self.repo.list_alerts(customer_id, contract_ids)

        events: list[TimelineEventRead] = []
        events.extend(self._contract_events(contracts))
        events.extend(self._valorization_events(valorizations))
        events.extend(self._note_events(notes))
        events.extend(self._activity_events(activities))
        events.extend(self._alert_events(alerts))

        if event_types:
            events = [event for event in events if event.event_type in event_types]

        if from_date:
            events = [event for event in events if event.timestamp >= from_date]

        if to_date:
            events = [event for event in events if event.timestamp <= to_date]

        events = sorted(events, key=lambda event: event.timestamp, reverse=True)
        return events[:limit]

    def _contract_events(self, contracts: Iterable[Contract]) -> list[TimelineEventRead]:
        events: list[TimelineEventRead] = []
        for contract in contracts:
            start_timestamp = self._as_datetime(contract.start_date)
            events.append(
                TimelineEventRead(
                    id=self._event_id(contract.id, "contract_signed", start_timestamp),
                    timestamp=start_timestamp,
                    event_type="contract_signed",
                    title=f"Podpisano umowe {contract.contract_number}",
                    detail=None,
                    author=None,
                    contract_id=contract.id,
                    valorization_id=None,
                    metadata={"status": contract.status},
                )
            )
        return events

    def _valorization_events(self, valorizations: Iterable[Valorization]) -> list[TimelineEventRead]:
        events: list[TimelineEventRead] = []
        for val in valorizations:
            planned_timestamp = self._as_datetime(val.planned_date)
            planned = TimelineEventRead(
                id=self._event_id(val.id, "valorization_started", planned_timestamp),
                timestamp=planned_timestamp,
                event_type="valorization_started",
                title=f"Waloryzacja {val.year} - rozpoczecie",
                detail=val.notes,
                author=None,
                contract_id=val.contract_id,
                valorization_id=val.id,
                metadata={"index_type": val.index_type, "index_value": str(val.index_value)},
            )
            events.append(planned)

            if val.status in {ValorizationStatus.APPROVED, ValorizationStatus.APPLIED}:
                approved_date = val.applied_date or val.planned_date
                approved_timestamp = self._as_datetime(approved_date)
                events.append(
                    TimelineEventRead(
                        id=self._event_id(val.id, "valorization_approved", approved_timestamp),
                        timestamp=approved_timestamp,
                        event_type="valorization_approved",
                        title=f"Waloryzacja {val.year} - zatwierdzona",
                        detail=val.notes,
                        author=None,
                        contract_id=val.contract_id,
                        valorization_id=val.id,
                        metadata={"status": val.status},
                    )
                )
        return events

    def _note_events(self, notes: Iterable[Note]) -> list[TimelineEventRead]:
        events: list[TimelineEventRead] = []
        for note in notes:
            events.append(
                TimelineEventRead(
                    id=note.id,
                    timestamp=note.created_at,
                event_type="note_added",
                    title="Dodano notatke",
                    detail=note.content,
                    author=str(note.created_by) if note.created_by else None,
                    contract_id=note.contract_id,
                    valorization_id=None,
                    metadata={"note_type": note.note_type},
                )
            )
        return events

    def _activity_events(self, activities: Iterable[ActivityLog]) -> list[TimelineEventRead]:
        events: list[TimelineEventRead] = []
        mapping: dict[ActivityType, TimelineEventType] = {
            ActivityType.MEETING: "meeting",
            ActivityType.CALL: "call",
            ActivityType.EMAIL: "email",
            ActivityType.DOCUMENT: "document",
            ActivityType.VERIFICATION: "verification",
            ActivityType.SYSTEM: "system",
            ActivityType.NOTE: "note_added",
        }
        for activity in activities:
            event_type = mapping.get(activity.activity_type)
            if event_type is None:
                continue
            events.append(
                TimelineEventRead(
                    id=activity.id,
                    timestamp=activity.activity_date,
                    event_type=event_type,
                    title=activity.description,
                    detail=None,
                    author=str(activity.performed_by) if activity.performed_by else None,
                    contract_id=activity.contract_id,
                    valorization_id=None,
                    metadata=activity.additional_data,
                )
            )
        return events

    def _alert_events(self, alerts: Iterable[Alert]) -> list[TimelineEventRead]:
        events: list[TimelineEventRead] = []
        for alert in alerts:
            events.append(
                TimelineEventRead(
                    id=alert.id,
                    timestamp=self._as_datetime(alert.trigger_date),
                    event_type="alert_triggered",
                    title=alert.message,
                    detail=None,
                    author=None,
                    contract_id=alert.contract_id,
                    valorization_id=None,
                    metadata={"status": alert.status, "alert_type": alert.alert_type},
                )
            )
        return events

    @staticmethod
    def _as_datetime(value: date | datetime | None) -> datetime:
        if value is None:
            raise ValueError("Timeline event date cannot be None")
        if isinstance(value, datetime):
            return value
        return datetime.combine(value, datetime.min.time(), tzinfo=UTC)

    @staticmethod
    def _event_id(entity_id: uuid.UUID, event_type: str, timestamp: datetime) -> uuid.UUID:
        return uuid.uuid5(
            uuid.NAMESPACE_URL,
            f"{entity_id}:{event_type}:{timestamp.isoformat()}",
        )
