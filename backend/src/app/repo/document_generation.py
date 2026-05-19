"""DocumentGeneration repository."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.contract import Contract
from app.models.contract_service import ContractService
from app.models.customer import Customer
from app.models.document_generation import DocumentGeneration
from app.models.rate import CustomerRate, CustomerRateMonth
from app.models.service import Service


class DocumentGenerationRepository:
    """Data access for DocumentGeneration model."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, generation_id: uuid.UUID) -> DocumentGeneration | None:
        stmt = (
            select(DocumentGeneration)
            .where(DocumentGeneration.id == generation_id)
            .options(
                selectinload(DocumentGeneration.pdf_attachment),
                selectinload(DocumentGeneration.cover_letter_attachment),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_customer(self, customer_id: uuid.UUID) -> list[DocumentGeneration]:
        stmt = (
            select(DocumentGeneration)
            .where(DocumentGeneration.customer_id == customer_id)
            .order_by(DocumentGeneration.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict[str, Any]) -> DocumentGeneration:
        gen = DocumentGeneration(**data)
        self.db.add(gen)
        await self.db.flush()
        await self.db.refresh(gen)
        return gen

    async def update(
        self, gen: DocumentGeneration, data: dict[str, Any]
    ) -> DocumentGeneration:
        for key, value in data.items():
            setattr(gen, key, value)
        await self.db.flush()
        await self.db.refresh(gen)
        return gen


class ValorizationContextRepository:
    """Read-only joins needed by the simulator and template engine.

    Pulls customer + contract + service + rate data in batches to avoid N+1
    when the simulator iterates contract services.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_customer_with_company(self, customer_id: uuid.UUID) -> Customer | None:
        stmt = (
            select(Customer)
            .where(Customer.id == customer_id, Customer.deleted_at.is_(None))
            .options(
                selectinload(Customer.company),
                selectinload(Customer.account_manager),
                selectinload(Customer.contact_persons),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_contract_with_services(self, contract_id: uuid.UUID) -> Contract | None:
        stmt = (
            select(Contract)
            .where(Contract.id == contract_id, Contract.deleted_at.is_(None))
            .options(
                selectinload(Contract.contract_services).selectinload(ContractService.service),
                selectinload(Contract.amendments),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_rates_for_services(
        self, contract_service_ids: list[uuid.UUID], year: int
    ) -> dict[uuid.UUID, CustomerRate]:
        """Latest rate (year) per ContractService — single query, no N+1."""
        if not contract_service_ids:
            return {}
        stmt = (
            select(CustomerRate)
            .where(
                CustomerRate.contract_service_id.in_(contract_service_ids),
                CustomerRate.year == year,
            )
            .options(selectinload(CustomerRate.monthly_prices))
        )
        result = await self.db.execute(stmt)
        return {rate.contract_service_id: rate for rate in result.scalars().all()}

    async def get_service_names(self, service_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
        if not service_ids:
            return {}
        stmt = select(Service.id, Service.name).where(Service.id.in_(service_ids))
        result = await self.db.execute(stmt)
        return {row.id: row.name for row in result.all()}

    @staticmethod
    def _unused() -> None:
        # Marker so CustomerRateMonth import is intentional for selectinload chain.
        _ = CustomerRateMonth
