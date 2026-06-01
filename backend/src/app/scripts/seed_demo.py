"""Seed demo data for HRK CRM (3 customers with events, assigned to demo.am and kasia)."""

import asyncio
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import or_, select

from app.core.database import AsyncSessionLocal
from app.models.activity import ActivityLog
from app.models.company import Company
from app.models.contract import Contract
from app.models.contract_service import ContractService
from app.models.customer import Customer
from app.models.enums import (
    ActivityType,
    BillingFrequency,
    BillingUnit,
    ContractStatus,
    ContractType,
    CustomerStatus,
    IndexType,
    NoteType,
    ValorizationStatus,
)
from app.models.note import Note
from app.models.rate import CustomerRate, CustomerRateMonth, Valorization
from app.models.service import Service
from app.models.service_group import ServiceGroup
from app.models.user import User

_USER_DEPARTMENTS = {
    "asia": "Specjalista HR",
    "mateusz": "Administrator IT",
    "tomek": "Handlowy",
    "kasia": "Opiekun klienta",
}


async def seed() -> None:  # noqa: C901
    async with AsyncSessionLocal() as session:
        # 1. Always ensure users exist and have correct departments (runs even on re-seed)
        user_stmt = select(User).where(or_(User.login == "asia", User.login == "mateusz", User.login == "kasia", User.login == "tomek"))
        res = await session.execute(user_stmt)
        existing_users = {u.login: u for u in res.scalars().all()}

        def get_or_create_user(login: str, email: str, department: str) -> User:
            if login in existing_users:
                u = existing_users[login]
                u.department = department
                return u
            u = User(login=login, email=email, department=department)
            session.add(u)
            return u

        user_asia = get_or_create_user("asia", "asia@hrk.eu", "Specjalista HR")
        user_mateusz = get_or_create_user("mateusz", "mateusz@hrk.eu", "Administrator IT")
        user_tomek = get_or_create_user("tomek", "tomek@hrk.eu", "Handlowy")
        user_kasia = get_or_create_user("kasia", "kasia@hrk.pl", "Opiekun klienta")

        await session.flush()

        # 2. Idempotency check — skip bulk data if already seeded
        seed_ckks = {f"C{i:03d}" for i in range(1, 11)}
        stmt = select(Customer.id).where(Customer.ckk.in_(seed_ckks))
        existing = await session.execute(stmt)
        if existing.first():
            await session.commit()
            print("docker-seed: demo data already exists. Updated user departments only.")
            return

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

        # 5. Service catalog (1 group, 4 services) — single source of truth
        # for the contract_services relation that drives the rate engine.
        service_group = ServiceGroup(name="Kadry & Płace")
        session.add(service_group)
        await session.flush()

        service_catalog = [
            Service(
                group_id=service_group.id,
                name="Listy płac — pracownicy etatowi",
                billing_unit=BillingUnit.PER_PERSON,
                billing_frequency=BillingFrequency.MONTHLY,
                vat_rate=Decimal("23.00"),
            ),
            Service(
                group_id=service_group.id,
                name="ZUS DRA — obsługa miesięczna",
                billing_unit=BillingUnit.RYCZALT,
                billing_frequency=BillingFrequency.MONTHLY,
                vat_rate=Decimal("23.00"),
            ),
            Service(
                group_id=service_group.id,
                name="PPK — obsługa wpłat",
                billing_unit=BillingUnit.PER_PERSON,
                billing_frequency=BillingFrequency.MONTHLY,
                vat_rate=Decimal("23.00"),
            ),
            Service(
                group_id=service_group.id,
                name="Konsultacje kadrowe",
                billing_unit=BillingUnit.PER_HOUR,
                billing_frequency=BillingFrequency.ON_DEMAND,
                vat_rate=Decimal("23.00"),
            ),
        ]
        session.add_all(service_catalog)
        await session.flush()

        # Reference rates per service (base price for year 2024 / no discount).
        # Subsequent years apply small valorisation deltas so the simulator has
        # historical context to render in the wizard.
        base_rates_2024 = {
            service_catalog[0].id: Decimal("32.00"),
            service_catalog[1].id: Decimal("450.00"),
            service_catalog[2].id: Decimal("12.00"),
            service_catalog[3].id: Decimal("180.00"),
        }
        # 6. Create related data (Contracts, Notes, Activities)
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

            # Attach billable services to contract A and seed yearly rates.
            # Three years of history (2024 → 2026) so the wizard has data to
            # work against when valorising for 2027.
            contract_services_a = [
                ContractService(
                    contract_id=c1.id,
                    service_id=service.id,
                    valid_from=c1.start_date,
                    is_billable=True,
                    scope_description=f"Realizacja w ramach umowy {c1.contract_number}",
                )
                for service in service_catalog[:3]
            ]
            session.add_all(contract_services_a)
            await session.flush()

            yearly_index_pct = {2025: Decimal("3.50"), 2026: Decimal("4.20")}
            for cs in contract_services_a:
                base_price = base_rates_2024[cs.service_id]
                for year in (2024, 2025, 2026):
                    if year == 2024:
                        price = base_price
                    else:
                        multiplier = Decimal("1") + yearly_index_pct[year] / Decimal("100")
                        price = (price * multiplier).quantize(Decimal("0.01"))
                    rate = CustomerRate(
                        contract_service_id=cs.id,
                        year=year,
                        base_price=price,
                        discount_pct=Decimal("0.00"),
                        created_by=manager_id,
                    )
                    session.add(rate)
                    await session.flush()
                    # Monthly breakdown — same price every month for simplicity.
                    for month in range(1, 13):
                        session.add(
                            CustomerRateMonth(
                                rate_id=rate.id, month=month, net_price=price
                            )
                        )

            # Varied Notes
            notes = [
                Note(customer_id=customer.id, note_type=NoteType.INTERNAL, content=f"Analiza roczna dla {customer.ckk} zakończona.", created_by=manager_id),
                Note(customer_id=customer.id, note_type=NoteType.CLIENT_REQUEST, content="Klient prosi o aktualizację stawek PPK.", created_by=manager_id),
            ]
            session.add_all(notes)

            # Timeline Activities — varied types, users, time spread
            now = datetime.now(UTC)
            cname = companies[idx - 1].name
            activities = [
                # Last 7 days
                ActivityLog(customer_id=customer.id, contract_id=c1.id, activity_type=ActivityType.CALL, description=f"Rozmowa o przedłużeniu umowy — {cname}", performed_by=manager_id, activity_date=now - timedelta(days=1)),
                ActivityLog(customer_id=customer.id, activity_type=ActivityType.EMAIL, description=f"Wysłano projekt aneksu waloryzacyjnego — {cname}", performed_by=manager_id, activity_date=now - timedelta(days=3)),
                ActivityLog(customer_id=customer.id, activity_type=ActivityType.SYSTEM, description=f"Alert: zbliżający się koniec umowy — {cname}", performed_by=None, activity_date=now - timedelta(days=5)),
                # Last 30 days
                ActivityLog(customer_id=customer.id, activity_type=ActivityType.MEETING, description=f"Spotkanie kwartalne — status operacyjny — {cname}", performed_by=manager_id, activity_date=now - timedelta(days=10)),
                ActivityLog(customer_id=customer.id, contract_id=c2.id, activity_type=ActivityType.DOCUMENT, description=f"Dodano aneks nr 3 do umowy SLA — {cname}", performed_by=manager_id, activity_date=now - timedelta(days=18)),
                ActivityLog(customer_id=customer.id, activity_type=ActivityType.NOTE, description=f"Klient zgłosił pytania dot. PPK — {cname}", performed_by=user_mateusz.id, activity_date=now - timedelta(days=22)),
                # Last 90 days
                ActivityLog(customer_id=customer.id, contract_id=c1.id, activity_type=ActivityType.VERIFICATION, description=f"Weryfikacja danych fakturowych — {cname}", performed_by=manager_id, activity_date=now - timedelta(days=45)),
                ActivityLog(customer_id=customer.id, activity_type=ActivityType.MEETING, description=f"Prezentacja wyników Q1 — {cname}", performed_by=user_asia.id if idx % 3 == 0 else manager_id, activity_date=now - timedelta(days=60)),
                ActivityLog(customer_id=customer.id, activity_type=ActivityType.EMAIL, description=f"Potwierdzenie warunków waloryzacji — {cname}", performed_by=manager_id, activity_date=now - timedelta(days=75)),
                ActivityLog(customer_id=customer.id, activity_type=ActivityType.SYSTEM, description=f"Automatyczna weryfikacja spójności danych — {cname}", performed_by=None, activity_date=now - timedelta(days=88)),
            ]
            session.add_all(activities)

            # Valorization data — current + next year for each customer
            current_year = today.year
            next_year = today.year + 1
            status_cycle = idx % 4
            if status_cycle == 0:
                current_status = ValorizationStatus.APPLIED
            elif status_cycle == 1:
                current_status = ValorizationStatus.APPROVED
            elif status_cycle == 2:
                current_status = ValorizationStatus.REJECTED
            else:
                current_status = ValorizationStatus.PENDING

            current_index_type = IndexType.GUS_CPI if idx % 2 == 0 else IndexType.FIXED_PCT
            current_index_value = Decimal("4.6") if idx % 2 == 0 else Decimal("5.2")
            current_planned_date = date(current_year, 1, 15)

            session.add(
                Valorization(
                    contract_id=c1.id,
                    year=current_year,
                    index_type=current_index_type,
                    index_value=current_index_value,
                    planned_date=current_planned_date,
                    applied_date=today - timedelta(days=30)
                    if current_status == ValorizationStatus.APPLIED
                    else None,
                    approved_by=manager_id
                    if current_status in (ValorizationStatus.APPROVED, ValorizationStatus.APPLIED)
                    else None,
                    status=current_status,
                    notes="Seedowana waloryzacja dla historii umowy.",
                    created_by=manager_id,
                )
            )

            session.add(
                Valorization(
                    contract_id=c1.id,
                    year=next_year,
                    index_type=IndexType.GUS_CPI,
                    index_value=Decimal("4.3"),
                    planned_date=date(next_year, 1, 15),
                    status=ValorizationStatus.PENDING,
                    notes="Waloryzacja zaplanowana na kolejny rok.",
                    created_by=manager_id,
                )
            )

        await session.commit()
        print(f"docker-seed completed: Generated 10 customers, {len(customers)*2} contracts and assigned to Kasia and others.")


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
