"""API tests for Notes CRUD endpoints."""

import uuid
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_crm_service
from app.main import app


class FakeNoteService:
    """In-memory Note service for testing."""

    def __init__(self) -> None:
        self.notes: dict[uuid.UUID, dict[str, Any]] = {}
        self.customers: set[uuid.UUID] = set()
        self.contracts: set[uuid.UUID] = set()

    def add_customer(self, customer_id: uuid.UUID) -> None:
        """Register a fake customer for validation."""
        self.customers.add(customer_id)

    def add_contract(self, contract_id: uuid.UUID) -> None:
        """Register a fake contract for validation."""
        self.contracts.add(contract_id)

    async def list_notes_by_customer(
        self,
        customer_id: uuid.UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """List notes for a customer."""
        items = [
            n for n in self.notes.values()
            if n["customer_id"] == customer_id and n["deleted_at"] is None
        ]
        items.sort(key=lambda x: x["created_at"], reverse=True)
        return items[skip : skip + limit]

    async def list_notes_by_contract(
        self,
        contract_id: uuid.UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """List notes for a contract."""
        items = [
            n for n in self.notes.values()
            if n["contract_id"] == contract_id and n["deleted_at"] is None
        ]
        items.sort(key=lambda x: x["created_at"], reverse=True)
        return items[skip : skip + limit]

    async def get_note(self, note_id: uuid.UUID) -> dict[str, Any] | None:
        """Get a single note by ID."""
        from fastapi import HTTPException, status

        note = self.notes.get(note_id)
        if not note or note["deleted_at"] is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        return note

    async def create_note(
        self,
        payload: Any,
        *,
        created_by: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Create a new note."""
        from fastapi import HTTPException, status

        data = payload.model_dump()

        # Validate references exist
        customer_id = data.get("customer_id")
        contract_id = data.get("contract_id")

        if customer_id and customer_id not in self.customers:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        if contract_id and contract_id not in self.contracts:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

        note_id = uuid.uuid4()
        now = datetime.now(UTC)

        note = {
            "id": note_id,
            "customer_id": customer_id,
            "contract_id": contract_id,
            "note_type": data["note_type"],
            "content": data["content"],
            "created_by": created_by,
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        }
        self.notes[note_id] = note
        return note

    async def update_note(self, note_id: uuid.UUID, payload: Any) -> dict[str, Any]:
        """Update an existing note."""

        note = await self.get_note(note_id)
        data = payload.model_dump(exclude_unset=True)

        for key, value in data.items():
            note[key] = value
        note["updated_at"] = datetime.now(UTC)

        return note

    async def delete_note(self, note_id: uuid.UUID) -> None:
        """Soft delete a note."""
        note = await self.get_note(note_id)
        note["deleted_at"] = datetime.now(UTC)


class FakeCRMServiceWithNotes:
    """CRM Service with Notes support for testing."""

    def __init__(self) -> None:
        self.note_service = FakeNoteService()

    async def list_notes_by_customer(self, customer_id: uuid.UUID, *, skip: int = 0, limit: int = 100):
        return await self.note_service.list_notes_by_customer(customer_id, skip=skip, limit=limit)

    async def list_notes_by_contract(self, contract_id: uuid.UUID, *, skip: int = 0, limit: int = 100):
        return await self.note_service.list_notes_by_contract(contract_id, skip=skip, limit=limit)

    async def get_note(self, note_id: uuid.UUID):
        return await self.note_service.get_note(note_id)

    async def create_note(self, payload: Any, *, created_by: uuid.UUID | None = None):
        return await self.note_service.create_note(payload, created_by=created_by)

    async def update_note(self, note_id: uuid.UUID, payload: Any):
        return await self.note_service.update_note(note_id, payload)

    async def delete_note(self, note_id: uuid.UUID) -> None:
        await self.note_service.delete_note(note_id)


@pytest.fixture
def client():
    """Create a test client with fake note service."""
    fake_service = FakeCRMServiceWithNotes()

    def override_get_crm_service():
        return fake_service

    app.dependency_overrides[get_crm_service] = override_get_crm_service

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def fake_service():
    """Get the fake service for test setup."""
    return FakeCRMServiceWithNotes()


class TestNotesAPI:
    """Tests for Notes API endpoints."""

    def test_list_notes_no_filter(self, client):
        """Test that listing notes without filter returns 422."""
        res = client.get("/api/v1/notes")
        assert res.status_code == 422
        assert "customer_id or contract_id" in res.json()["detail"]

    def test_list_notes_both_filters(self, client):
        """Test that listing with both filters returns 422."""
        res = client.get("/api/v1/notes?customer_id=550e8400-e29b-41d4-a716-446655440000&contract_id=550e8400-e29b-41d4-a716-446655440001")
        assert res.status_code == 422
        assert "Cannot filter by both" in res.json()["detail"]

    def test_create_note_missing_parent(self, client):
        """Test that creating note without customer_id and contract_id returns 422."""
        payload = {
            "note_type": "meeting",
            "content": "Test note content",
        }
        res = client.post("/api/v1/notes", json=payload)
        assert res.status_code == 422
        assert "customer_id or contract_id" in str(res.json())

    def test_create_note_both_parents(self, client):
        """Test that creating note with both IDs returns 422."""
        payload = {
            "customer_id": str(uuid.uuid4()),
            "contract_id": str(uuid.uuid4()),
            "note_type": "meeting",
            "content": "Test note content",
        }
        res = client.post("/api/v1/notes", json=payload)
        assert res.status_code == 422
        assert "Cannot provide both" in str(res.json())

    def test_create_note_customer_not_found(self, client):
        """Test that creating note for non-existent customer returns 404."""
        payload = {
            "customer_id": str(uuid.uuid4()),
            "note_type": "meeting",
            "content": "Test note content",
        }
        res = client.post("/api/v1/notes", json=payload)
        assert res.status_code == 404
        assert res.json()["detail"] == "Customer not found"

    def test_create_and_get_note_success(self, client):
        """Test successful note creation and retrieval."""
        customer_id = uuid.uuid4()

        # Add customer to fake service
        fake_svc = FakeCRMServiceWithNotes()
        fake_svc.note_service.add_customer(customer_id)

        def override():
            return fake_svc

        app.dependency_overrides[get_crm_service] = override

        try:
            # Create note
            payload = {
                "customer_id": str(customer_id),
                "note_type": "meeting",
                "content": "Test note for customer",
            }
            res = client.post("/api/v1/notes", json=payload)
            assert res.status_code == 201
            data = res.json()
            assert data["content"] == "Test note for customer"
            assert data["note_type"] == "meeting"
            assert data["customer_id"] == str(customer_id)
            assert data["contract_id"] is None
            note_id = data["id"]

            # Get note by ID
            res = client.get(f"/api/v1/notes/{note_id}")
            assert res.status_code == 200
            assert res.json()["id"] == note_id

            # List notes by customer
            res = client.get(f"/api/v1/notes?customer_id={customer_id}")
            assert res.status_code == 200
            assert len(res.json()) == 1

        finally:
            app.dependency_overrides.clear()

    def test_update_note_success(self, client):
        """Test successful note update."""
        customer_id = uuid.uuid4()

        fake_svc = FakeCRMServiceWithNotes()
        fake_svc.note_service.add_customer(customer_id)

        def override():
            return fake_svc

        app.dependency_overrides[get_crm_service] = override

        try:
            # Create note
            create_payload = {
                "customer_id": str(customer_id),
                "note_type": "meeting",
                "content": "Original content",
            }
            res = client.post("/api/v1/notes", json=create_payload)
            note_id = res.json()["id"]

            # Update note
            update_payload = {
                "content": "Updated content",
            }
            res = client.patch(f"/api/v1/notes/{note_id}", json=update_payload)
            assert res.status_code == 200
            assert res.json()["content"] == "Updated content"
            # Note type should remain unchanged
            assert res.json()["note_type"] == "meeting"

        finally:
            app.dependency_overrides.clear()

    def test_delete_note_success(self, client):
        """Test successful note deletion (soft delete)."""
        customer_id = uuid.uuid4()

        fake_svc = FakeCRMServiceWithNotes()
        fake_svc.note_service.add_customer(customer_id)

        def override():
            return fake_svc

        app.dependency_overrides[get_crm_service] = override

        try:
            # Create note
            create_payload = {
                "customer_id": str(customer_id),
                "note_type": "meeting",
                "content": "Note to delete",
            }
            res = client.post("/api/v1/notes", json=create_payload)
            note_id = res.json()["id"]

            # Delete note
            res = client.delete(f"/api/v1/notes/{note_id}")
            assert res.status_code == 204

            # Try to get deleted note
            res = client.get(f"/api/v1/notes/{note_id}")
            assert res.status_code == 404

        finally:
            app.dependency_overrides.clear()

    def test_get_note_not_found(self, client):
        """Test that getting non-existent note returns 404."""
        res = client.get(f"/api/v1/notes/{uuid.uuid4()}")
        assert res.status_code == 404
        assert res.json()["detail"] == "Note not found"

    def test_update_note_not_found(self, client):
        """Test that updating non-existent note returns 404."""
        res = client.patch(f"/api/v1/notes/{uuid.uuid4()}", json={"content": "Update"})
        assert res.status_code == 404

    def test_delete_note_not_found(self, client):
        """Test that deleting non-existent note returns 404."""
        res = client.delete(f"/api/v1/notes/{uuid.uuid4()}")
        assert res.status_code == 404
