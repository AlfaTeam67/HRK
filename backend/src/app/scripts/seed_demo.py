"""Seed demo data for HRK CRM (3 customers with events)."""

import asyncio
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.activity import ActivityLog
from app.models.company import Company
from app.models.contract import Contract
from app.models.customer import Customer
from app.models.enums import (
    ActivityType,
    ContractStatus,
    ContractType,
    CustomerStatus,
    IndexType,
    NoteType,
    ValorizationStatus,
)
from app.models.note import Note
from app.models.rate import Valorization
from app.models.user import User


async def seed() -> None:
    async with AsyncSessionLocal() as session:
        seed_ckks = {"C001", "C002", "C003"}
        existing = await session.execute(select(Customer.id).where(Customer.ckk.in_(seed_ckks)))
        if existing.first():
            raise SystemExit("docker-seed: seed customers already exist in database.")

        user = User(login="demo.am", email="demo.am@hrk.eu")
        companies = [
            Company(name="Empik S.A."),
            Company(name="Decathlon Sp. z o.o."),
            Company(name="Leroy Merlin Polska Sp. z o.o."),
        ]
        session.add_all([user, *companies])
        await session.flush()

        customers = [
            Customer(
                ckk="C001",
                ckd="CKD001",
                company_id=companies[0].id,
                account_manager_id=user.id,
                status=CustomerStatus.ACTIVE,
                segment="Enterprise",
                industry="Produkcyjna",
                employee_count=320,
                billing_email="finanse@empik.com",
                invoice_nip="5210001111",
                phone="+48 500 111 222",
            ),
            Customer(
                ckk="C002",
                ckd="CKD002",
                company_id=companies[1].id,
                account_manager_id=user.id,
                status=CustomerStatus.NEEDS_ATTENTION,
                segment="SMB",
                industry="IT",
                employee_count=68,
                billing_email="billing@decathlon.com",
                invoice_nip="5210002222",
                phone="+48 500 333 444",
            ),
            Customer(
                ckk="C003",
                ckd="CKD003",
                company_id=companies[2].id,
                account_manager_id=user.id,
                status=CustomerStatus.CHURN_RISK,
                segment="Mid",
                industry="Retail",
                employee_count=140,
                billing_email="faktury@leroymerlin.com",
                invoice_nip="5210003333",
                phone="+48 500 555 666",
            ),
        ]
        session.add_all(customers)
        await session.flush()

        today = date.today()
        contracts: list[Contract] = []
        valorizations: list[Valorization] = []
        notes: list[Note] = []
        activities: list[ActivityLog] = []

        for idx, customer in enumerate(customers, start=1):
            contract = Contract(
                customer_id=customer.id,
                account_manager_id=user.id,
                contract_number=f"HRK/EMP/2024/0{idx}",
                contract_type=ContractType.RAMOWA,
                status=ContractStatus.ACTIVE,
                start_date=today - timedelta(days=300 - idx * 30),
                end_date=today + timedelta(days=365 + idx * 10),
                billing_cycle=None,
            )
            session.add(contract)
            await session.flush()
            contracts.append(contract)

            valorization = Valorization(
                contract_id=contract.id,
                year=today.year,
                index_type=IndexType.GUS_CPI,
                index_value=Decimal("5.8"),
                planned_date=today - timedelta(days=45 - idx * 5),
                applied_date=today - timedelta(days=15 - idx * 2),
                status=ValorizationStatus.APPROVED,
                notes="Zatwierdzono waloryzacje roczna",
                created_by=user.id,
            )
            valorizations.append(valorization)

            notes.append(
                Note(
                    customer_id=customer.id,
                    contract_id=contract.id,
                    note_type=NoteType.MEETING,
                    content="Spotkanie onboardingowe - omowienie zakresu uslug.",
                    created_by=user.id,
                )
            )
            notes.append(
                Note(
                    customer_id=customer.id,
                    note_type=NoteType.INTERNAL,
                    content="Klient preferuje kontakt mailowy w godzinach 9-15.",
                    created_by=user.id,
                )
            )

            activities.append(
                ActivityLog(
                    customer_id=customer.id,
                    contract_id=contract.id,
                    activity_type=ActivityType.MEETING,
                    description="Warsztat wdrozeniowy z zespolami HR",
                    performed_by=user.id,
                    activity_date=datetime.now(UTC) - timedelta(days=60 - idx * 5),
                    additional_data={"location": "Teams"},
                )
            )
            activities.append(
                ActivityLog(
                    customer_id=customer.id,
                    activity_type=ActivityType.CALL,
                    description="Follow-up po waloryzacji",
                    performed_by=user.id,
                    activity_date=datetime.now(UTC) - timedelta(days=10 + idx * 2),
                    additional_data={"duration_min": 25},
                )
            )

        session.add_all(valorizations)
        session.add_all(notes)
        session.add_all(activities)
        await session.commit()
        print("docker-seed completed: 3 customers with contracts, valorizations, notes, activities.")


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
