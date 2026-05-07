"""Seed demo data for HRK CRM (3 customers with events, assigned to demo.am and kasia)."""

import asyncio
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import or_, select

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
        # 1. Idempotency check (Expand to check more CKKs)
        seed_ckks = {f"C{i:03d}" for i in range(1, 11)}
        stmt = select(Customer.id).where(Customer.ckk.in_(seed_ckks))
        existing = await session.execute(stmt)
        if existing.first():
            print("docker-seed: demo data already exists. Skipping.")
            return

        # 2. Create Users (Ensure Asia, Mateusz and Kasia exist in DB)
        # We search for them first to avoid duplicates if they were created by login
        user_stmt = select(User).where(or_(User.login == "asia", User.login == "mateusz", User.login == "kasia", User.login == "tomek"))
        res = await session.execute(user_stmt)
        existing_users = {u.login: u for u in res.scalars().all()}

        def get_or_create_user(login: str, email: str) -> User:
            if login in existing_users:
                return existing_users[login]
            u = User(login=login, email=email)
            session.add(u)
            return u

        user_asia = get_or_create_user("asia", "asia@hrk.eu")
        user_tomek = get_or_create_user("tomek", "tomek@hrk.eu")
        user_kasia = get_or_create_user("kasia", "kasia@hrk.pl")

        await session.flush()

        # 3. Create Companies
        company_names = [
            "Empik S.A.", "Decathlon Sp. z o.o.", "Leroy Merlin Polska",
            "Allegro.pl Sp. z o.o.", "Rossmann SDP", "Żabka Polska",
            "Carrefour Polska", "Pepco Poland", "MediaMarkt Polska", "TechNova S.A."
        ]
        companies = [Company(name=name) for name in company_names]
        session.add_all(companies)
        await session.flush()

        # 4. Create Customers and assign managers (Kasia gets almost all for demo)
        customer_data = [
            ("C001", "CKD001", companies[0], user_kasia, CustomerStatus.ACTIVE, "Enterprise", "Retail", 1200),
            ("C002", "CKD002", companies[1], user_kasia, CustomerStatus.NEEDS_ATTENTION, "Mid", "Retail", 850),
            ("C003", "CKD003", companies[2], user_tomek, CustomerStatus.ACTIVE, "Enterprise", "Retail", 2400),
            ("C004", "CKD004", companies[3], user_kasia, CustomerStatus.ACTIVE, "Enterprise", "Ecommerce", 4500),
            ("C005", "CKD005", companies[4], user_kasia, CustomerStatus.ACTIVE, "Enterprise", "Retail", 3200),
            ("C006", "CKD006", companies[5], user_kasia, CustomerStatus.ACTIVE, "Mid", "Retail", 15000),
            ("C007", "CKD007", companies[6], user_kasia, CustomerStatus.ACTIVE, "Enterprise", "Retail", 8000),
            ("C008", "CKD008", companies[7], user_kasia, CustomerStatus.CHURN_RISK, "Mid", "Retail", 5400),
            ("C009", "CKD009", companies[8], user_kasia, CustomerStatus.ACTIVE, "Enterprise", "Electronics", 2100),
            ("C010", "CKD010", companies[9], user_asia, CustomerStatus.ACTIVE, "Mid", "Tech", 150),
        ]

        customers = []
        for ckk, ckd, comp, mgr, status, seg, ind, count in customer_data:
            customers.append(Customer(
                ckk=ckk, ckd=ckd, company_id=comp.id, account_manager_id=mgr.id,
                status=status, segment=seg, industry=ind, employee_count=count,
                billing_email=f"contact@{comp.name.lower().replace(' ', '')}.pl",
                invoice_nip=f"521000{ckk[1:]}0",
                phone="+48 500 000 " + ckk[1:],
                address_street="Ulica Testowa " + ckk[1:],
                address_city="Warszawa",
                address_postal="00-001"
            ))

        session.add_all(customers)
        await session.flush()

        # 5. Create related data (Contracts, Notes, Activities)
        today = date.today()
        for idx, customer in enumerate(customers, start=1):
            manager_id = customer.account_manager_id

            # 2 Contracts per customer
            c1 = Contract(
                customer_id=customer.id, account_manager_id=manager_id,
                contract_number=f"HRK/CON/2024/{idx:03d}/A",
                contract_type=ContractType.RAMOWA, status=ContractStatus.ACTIVE,
                start_date=today - timedelta(days=500), end_date=today + timedelta(days=200),
            )
            c2 = Contract(
                customer_id=customer.id, account_manager_id=manager_id,
                contract_number=f"HRK/CON/2024/{idx:03d}/B",
                contract_type=ContractType.SLA, status=ContractStatus.ACTIVE,
                start_date=today - timedelta(days=100), end_date=today + timedelta(days=600),
            )
            session.add_all([c1, c2])
            await session.flush()

            # Varied Notes
            notes = [
                Note(customer_id=customer.id, note_type=NoteType.INTERNAL, content=f"Analiza roczna dla {customer.ckk} zakończona.", created_by=manager_id),
                Note(customer_id=customer.id, note_type=NoteType.CLIENT_REQUEST, content="Klient prosi o aktualizację stawek PPK.", created_by=manager_id),
            ]
            session.add_all(notes)

            # Timeline Activities
            activities = [
                ActivityLog(customer_id=customer.id, activity_type=ActivityType.CALL, description="Rozmowa o przedłużeniu umowy", performed_by=manager_id, activity_date=datetime.now(UTC) - timedelta(days=2)),
                ActivityLog(customer_id=customer.id, activity_type=ActivityType.MEETING, description="Spotkanie kwartalne - status operacyjny", performed_by=manager_id, activity_date=datetime.now(UTC) - timedelta(days=15)),
                ActivityLog(customer_id=customer.id, activity_type=ActivityType.EMAIL, description="Wysłano projekt aneksu waloryzacyjnego", performed_by=manager_id, activity_date=datetime.now(UTC) - timedelta(hours=5)),
            ]
            session.add_all(activities)

            # Valorization for some
            if idx % 2 == 1:
                session.add(Valorization(
                    contract_id=c1.id, year=today.year, index_type=IndexType.GUS_CPI,
                    index_value=Decimal("4.5"), planned_date=today + timedelta(days=15),
                    status=ValorizationStatus.PENDING, created_by=manager_id
                ))

        await session.commit()
        print(f"docker-seed completed: Generated 10 customers, {len(customers)*2} contracts and assigned to Kasia and others.")


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
