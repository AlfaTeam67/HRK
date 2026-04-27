"""API tests for CRM CRUD endpoints."""

import uuid
from datetime import UTC, date, datetime
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.crm import get_crm_service
from app.main import app
from app.models.enums import (
    BillingFrequency,
    BillingUnit,
    ContractStatus,
    ContractType,
    CustomerStatus,
)
from app.schemas.crm import ContractServiceCreate


class FakeCRMService:
    """In-memory CRM service used to test API contracts."""

    def __init__(self) -> None:
        self.company_a = uuid.uuid4()
        self.company_b = uuid.uuid4()
        self.account_manager = uuid.uuid4()

        self.customers: dict[uuid.UUID, dict[str, Any]] = {}
        self.contracts: dict[uuid.UUID, dict[str, Any]] = {}
        self.services: dict[uuid.UUID, dict[str, Any]] = {}
        self.contract_services: dict[uuid.UUID, dict[str, Any]] = {}

    async def list_customers(self, **kwargs):
        items = [c for c in self.customers.values() if c["deleted_at"] is None]

        company_id = kwargs.get("company_id")
        statuses = kwargs.get("statuses")
        created_from = kwargs.get("created_from")
        created_to = kwargs.get("created_to")

        if company_id:
            items = [c for c in items if c["company_id"] == company_id]
        if statuses:
            items = [c for c in items if c["status"].value in statuses]
        if created_from:
            items = [c for c in items if c["created_at"].date() >= created_from]
        if created_to:
            items = [c for c in items if c["created_at"].date() <= created_to]

        return [SimpleNamespace(**item) for item in items]

    async def create_customer(self, payload):
        for existing in self.customers.values():
            if existing["ckk"] == payload.ckk and existing["deleted_at"] is None:
                raise HTTPException(status_code=409, detail="Customer with provided identifiers already exists")

        now = datetime.now(UTC)
        customer_id = uuid.uuid4()
        item = {
            "id": customer_id,
            "ckk": payload.ckk,
            "ckd": payload.ckd,
            "company_id": payload.company_id,
            "account_manager_id": payload.account_manager_id,
            "status": payload.status,
            "segment": payload.segment,
            "industry": payload.industry,
            "employee_count": payload.employee_count,
            "payment_period_days": payload.payment_period_days,
            "account_number": payload.account_number,
            "billing_nip": payload.billing_nip,
            "billing_email": payload.billing_email,
            "invoice_nip": payload.invoice_nip,
            "phone": payload.phone,
            "address_street": payload.address_street,
            "address_city": payload.address_city,
            "address_postal": payload.address_postal,
            "address_country": payload.address_country,
            "additional_data": payload.additional_data,
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        }
        self.customers[customer_id] = item
        return SimpleNamespace(**item)

    async def get_customer(self, customer_id: uuid.UUID):
        item = self.customers.get(customer_id)
        if not item or item["deleted_at"] is not None:
            raise HTTPException(status_code=404, detail="Customer not found")
        return SimpleNamespace(**item)

    async def update_customer(self, customer_id: uuid.UUID, payload):
        item = self.customers.get(customer_id)
        if not item or item["deleted_at"] is not None:
            raise HTTPException(status_code=404, detail="Customer not found")

        data = payload.model_dump(exclude_unset=True)
        item.update(data)
        item["updated_at"] = datetime.now(UTC)
        return SimpleNamespace(**item)

    async def delete_customer(self, customer_id: uuid.UUID):
        item = self.customers.get(customer_id)
        if not item or item["deleted_at"] is not None:
            raise HTTPException(status_code=404, detail="Customer not found")

        has_contracts = any(
            c["customer_id"] == customer_id and c["deleted_at"] is None for c in self.contracts.values()
        )
        if has_contracts:
            raise HTTPException(status_code=409, detail="Customer has active contracts and cannot be deleted")

        item["deleted_at"] = datetime.now(UTC)

    async def list_contracts(self, **kwargs):
        items = [c for c in self.contracts.values() if c["deleted_at"] is None]

        company_id = kwargs.get("company_id")
        statuses = kwargs.get("statuses")
        start_from = kwargs.get("start_from")
        start_to = kwargs.get("start_to")
        end_from = kwargs.get("end_from")
        end_to = kwargs.get("end_to")

        if company_id:
            items = [
                c
                for c in items
                if self.customers.get(c["customer_id"], {}).get("company_id") == company_id
            ]
        if statuses:
            items = [c for c in items if c["status"].value in statuses]
        if start_from:
            items = [c for c in items if c["start_date"] >= start_from]
        if start_to:
            items = [c for c in items if c["start_date"] <= start_to]
        if end_from:
            items = [c for c in items if c["end_date"] and c["end_date"] >= end_from]
        if end_to:
            items = [c for c in items if c["end_date"] and c["end_date"] <= end_to]

        return [SimpleNamespace(**item) for item in items]

    async def create_contract(self, payload):
        if payload.customer_id not in self.customers or self.customers[payload.customer_id]["deleted_at"]:
            raise HTTPException(status_code=404, detail="Customer not found")

        duplicate = any(
            c["contract_number"] == payload.contract_number and c["deleted_at"] is None
            for c in self.contracts.values()
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="Contract number already exists")

        now = datetime.now(UTC)
        contract_id = uuid.uuid4()
        item = {
            "id": contract_id,
            "customer_id": payload.customer_id,
            "account_manager_id": payload.account_manager_id,
            "contract_number": payload.contract_number,
            "contract_type": payload.contract_type,
            "status": payload.status,
            "start_date": payload.start_date,
            "end_date": payload.end_date,
            "notice_period_days": payload.notice_period_days,
            "notice_conditions": payload.notice_conditions,
            "billing_cycle": payload.billing_cycle,
            "governing_law": payload.governing_law,
            "parent_contract_id": payload.parent_contract_id,
            "notes": payload.notes,
            "additional_data": payload.additional_data,
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        }
        self.contracts[contract_id] = item
        return SimpleNamespace(**item)

    async def get_contract(self, contract_id: uuid.UUID):
        item = self.contracts.get(contract_id)
        if not item or item["deleted_at"] is not None:
            raise HTTPException(status_code=404, detail="Contract not found")
        return SimpleNamespace(**item)

    async def update_contract(self, contract_id: uuid.UUID, payload):
        item = self.contracts.get(contract_id)
        if not item or item["deleted_at"] is not None:
            raise HTTPException(status_code=404, detail="Contract not found")

        data = payload.model_dump(exclude_unset=True)
        item.update(data)
        item["updated_at"] = datetime.now(UTC)
        return SimpleNamespace(**item)

    async def delete_contract(self, contract_id: uuid.UUID):
        item = self.contracts.get(contract_id)
        if not item or item["deleted_at"] is not None:
            raise HTTPException(status_code=404, detail="Contract not found")
        item["deleted_at"] = datetime.now(UTC)

    async def list_services(self, **kwargs):
        items = [s for s in self.services.values() if s["deleted_at"] is None]
        company_id = kwargs.get("company_id")
        is_active = kwargs.get("is_active")

        if is_active is not None:
            items = [s for s in items if s["is_active"] is is_active]

        if company_id:
            filtered: list[dict[str, Any]] = []
            for service in items:
                service_used = any(
                    rel["service_id"] == service["id"]
                    and self.customers.get(self.contracts.get(rel["contract_id"], {}).get("customer_id"), {}).get("company_id")
                    == company_id
                    for rel in self.contract_services.values()
                )
                if service_used:
                    filtered.append(service)
            items = filtered

        return [SimpleNamespace(**item) for item in items]

    async def create_service(self, payload):
        service_id = uuid.uuid4()
        now = datetime.now(UTC)
        item = {
            "id": service_id,
            "group_id": payload.group_id,
            "name": payload.name,
            "billing_unit": payload.billing_unit,
            "billing_frequency": payload.billing_frequency,
            "vat_rate": payload.vat_rate,
            "is_active": payload.is_active,
            "additional_data": payload.additional_data,
            "created_at": now,
            "deleted_at": None,
        }
        self.services[service_id] = item
        return SimpleNamespace(**item)

    async def get_service(self, service_id: uuid.UUID):
        item = self.services.get(service_id)
        if not item or item["deleted_at"] is not None:
            raise HTTPException(status_code=404, detail="Service not found")
        return SimpleNamespace(**item)

    async def update_service(self, service_id: uuid.UUID, payload):
        item = self.services.get(service_id)
        if not item or item["deleted_at"] is not None:
            raise HTTPException(status_code=404, detail="Service not found")

        data = payload.model_dump(exclude_unset=True)
        item.update(data)
        return SimpleNamespace(**item)

    async def delete_service(self, service_id: uuid.UUID):
        item = self.services.get(service_id)
        if not item or item["deleted_at"] is not None:
            raise HTTPException(status_code=404, detail="Service not found")
        item["deleted_at"] = datetime.now(UTC)

    async def attach_service_to_contract(self, contract_id: uuid.UUID, payload: ContractServiceCreate):
        if contract_id not in self.contracts or self.contracts[contract_id]["deleted_at"] is not None:
            raise HTTPException(status_code=404, detail="Contract not found")
        if payload.service_id not in self.services or self.services[payload.service_id]["deleted_at"] is not None:
            raise HTTPException(status_code=404, detail="Service not found")

        duplicate = any(
            rel["contract_id"] == contract_id
            and rel["service_id"] == payload.service_id
            and rel["valid_from"] == payload.valid_from
            for rel in self.contract_services.values()
        )
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Service is already attached for the same validity start date",
            )

        relation_id = uuid.uuid4()
        item = {
            "id": relation_id,
            "contract_id": contract_id,
            "service_id": payload.service_id,
            "scope_description": payload.scope_description,
            "volume_limit": payload.volume_limit,
            "volume_unit": payload.volume_unit,
            "sla_definition": payload.sla_definition,
            "is_billable": payload.is_billable,
            "valid_from": payload.valid_from,
            "valid_to": payload.valid_to,
            "additional_data": payload.additional_data,
        }
        self.contract_services[relation_id] = item
        return SimpleNamespace(**item)

    async def list_contract_services(self, contract_id: uuid.UUID):
        if contract_id not in self.contracts or self.contracts[contract_id]["deleted_at"] is not None:
            raise HTTPException(status_code=404, detail="Contract not found")
        items = [rel for rel in self.contract_services.values() if rel["contract_id"] == contract_id]
        return [SimpleNamespace(**item) for item in items]

    async def detach_service_from_contract(self, contract_id: uuid.UUID, relation_id: uuid.UUID):
        if contract_id not in self.contracts or self.contracts[contract_id]["deleted_at"] is not None:
            raise HTTPException(status_code=404, detail="Contract not found")
        item = self.contract_services.get(relation_id)
        if not item or item["contract_id"] != contract_id:
            raise HTTPException(status_code=404, detail="Contract service relation not found")
        del self.contract_services[relation_id]


@pytest.fixture
def fake_crm_service() -> FakeCRMService:
    return FakeCRMService()


@pytest.fixture
def client(fake_crm_service: FakeCRMService) -> TestClient:
    app.dependency_overrides[get_crm_service] = lambda: fake_crm_service
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_customers_crud_and_filters(client: TestClient, fake_crm_service: FakeCRMService) -> None:
    payload_1 = {
        "ckk": "CUST001",
        "ckd": "CKD001",
        "company_id": str(fake_crm_service.company_a),
        "account_manager_id": str(fake_crm_service.account_manager),
        "status": CustomerStatus.ACTIVE.value,
        "additional_data": {"tier": "gold"},
    }
    payload_2 = {
        "ckk": "CUST002",
        "company_id": str(fake_crm_service.company_b),
        "account_manager_id": str(fake_crm_service.account_manager),
        "status": CustomerStatus.INACTIVE.value,
        "additional_data": {},
    }

    create_1 = client.post("/api/v1/customers", json=payload_1)
    assert create_1.status_code == 201

    create_2 = client.post("/api/v1/customers", json=payload_2)
    assert create_2.status_code == 201

    filtered = client.get(
        "/api/v1/customers",
        params={
            "company_id": str(fake_crm_service.company_a),
            "statuses": CustomerStatus.ACTIVE.value,
            "created_from": date.today().isoformat(),
        },
    )
    assert filtered.status_code == 200
    data = filtered.json()
    assert len(data) == 1
    assert data[0]["ckk"] == "CUST001"

    duplicate = client.post("/api/v1/customers", json=payload_1)
    assert duplicate.status_code == 409


def test_contracts_crud_and_date_status_filters(
    client: TestClient,
    fake_crm_service: FakeCRMService,
) -> None:
    customer_resp = client.post(
        "/api/v1/customers",
        json={
            "ckk": "CUST100",
            "company_id": str(fake_crm_service.company_a),
            "account_manager_id": str(fake_crm_service.account_manager),
            "status": CustomerStatus.ACTIVE.value,
            "additional_data": {},
        },
    )
    customer_id = customer_resp.json()["id"]

    contract_payload = {
        "customer_id": customer_id,
        "contract_number": "HRK/2026/001",
        "contract_type": ContractType.RAMOWA.value,
        "status": ContractStatus.ACTIVE.value,
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "additional_data": {},
    }

    create_contract = client.post("/api/v1/contracts", json=contract_payload)
    assert create_contract.status_code == 201

    duplicate_contract = client.post("/api/v1/contracts", json=contract_payload)
    assert duplicate_contract.status_code == 409

    filtered = client.get(
        "/api/v1/contracts",
        params={
            "company_id": str(fake_crm_service.company_a),
            "statuses": ContractStatus.ACTIVE.value,
            "start_from": "2026-01-01",
            "end_to": "2026-12-31",
        },
    )
    assert filtered.status_code == 200
    assert len(filtered.json()) == 1


def test_service_relation_flow_and_conflicts(client: TestClient, fake_crm_service: FakeCRMService) -> None:
    customer_resp = client.post(
        "/api/v1/customers",
        json={
            "ckk": "CUST200",
            "company_id": str(fake_crm_service.company_a),
            "account_manager_id": str(fake_crm_service.account_manager),
            "status": CustomerStatus.ACTIVE.value,
            "additional_data": {},
        },
    )
    customer_id = customer_resp.json()["id"]

    contract_resp = client.post(
        "/api/v1/contracts",
        json={
            "customer_id": customer_id,
            "contract_number": "HRK/2026/200",
            "contract_type": ContractType.SLA.value,
            "status": ContractStatus.SIGNED.value,
            "start_date": "2026-02-01",
            "end_date": "2027-01-31",
            "additional_data": {},
        },
    )
    contract_id = contract_resp.json()["id"]

    service_resp = client.post(
        "/api/v1/services",
        json={
            "group_id": str(uuid.uuid4()),
            "name": "Payroll processing",
            "billing_unit": BillingUnit.PER_PERSON.value,
            "billing_frequency": BillingFrequency.MONTHLY.value,
            "vat_rate": "23.00",
            "is_active": True,
            "additional_data": {},
        },
    )
    assert service_resp.status_code == 201
    service_id = service_resp.json()["id"]

    attach_payload = {
        "service_id": service_id,
        "scope_description": "Monthly payroll up to 100 FTE",
        "valid_from": "2026-02-01",
        "valid_to": "2026-12-31",
        "is_billable": True,
        "additional_data": {},
    }

    attach = client.post(f"/api/v1/contracts/{contract_id}/services", json=attach_payload)
    assert attach.status_code == 201

    duplicate_attach = client.post(f"/api/v1/contracts/{contract_id}/services", json=attach_payload)
    assert duplicate_attach.status_code == 409

    listed = client.get(f"/api/v1/contracts/{contract_id}/services")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    relation_id = listed.json()[0]["id"]
    detach = client.delete(f"/api/v1/contracts/{contract_id}/services/{relation_id}")
    assert detach.status_code == 204


def test_customer_delete_blocked_when_active_contract_exists(
    client: TestClient,
    fake_crm_service: FakeCRMService,
) -> None:
    customer_resp = client.post(
        "/api/v1/customers",
        json={
            "ckk": "CUST300",
            "company_id": str(fake_crm_service.company_a),
            "account_manager_id": str(fake_crm_service.account_manager),
            "status": CustomerStatus.ACTIVE.value,
            "additional_data": {},
        },
    )
    customer_id = customer_resp.json()["id"]

    contract_resp = client.post(
        "/api/v1/contracts",
        json={
            "customer_id": customer_id,
            "contract_number": "HRK/2026/300",
            "contract_type": ContractType.DPA.value,
            "status": ContractStatus.ACTIVE.value,
            "start_date": "2026-03-01",
            "end_date": "2027-03-01",
            "additional_data": {},
        },
    )
    assert contract_resp.status_code == 201

    delete_customer = client.delete(f"/api/v1/customers/{customer_id}")
    assert delete_customer.status_code == 409


def test_openapi_contains_crm_paths(client: TestClient) -> None:
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/customers" in paths
    assert "/api/v1/contracts" in paths
    assert "/api/v1/services" in paths
