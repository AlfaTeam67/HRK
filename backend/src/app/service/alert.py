import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog
from app.models.contract import Contract
from app.models.customer import Customer
from app.models.enums import ContractStatus, CustomerStatus, ValorizationStatus
from app.models.rate import Valorization
from app.schemas.alert import AlertRead
from app.schemas.dashboard import DashboardKpi

AlertType = Literal[
    "contract_expiry_30", "contract_expiry_60", "contract_expiry_90",
    "valorization_overdue", "valorization_pending", "no_contact",
]
AlertSeverity = Literal["urgent", "high", "medium"]

_EXPIRY_CONFIG: list[tuple[int, int, AlertType, AlertSeverity, str]] = [
    (0, 30, "contract_expiry_30", "urgent", "Wygasająca umowa (30 dni)"),
    (31, 60, "contract_expiry_60", "high", "Wygasająca umowa (60 dni)"),
    (61, 90, "contract_expiry_90", "medium", "Wygasająca umowa (90 dni)"),
]


class AlertService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_alerts(self, account_manager_id: uuid.UUID | None = None) -> list[AlertRead]:
        today = date.today()
        now = datetime.now(UTC)

        alerts: list[AlertRead] = []
        alerts.extend(await self._get_contract_expiry_alerts(today, now, account_manager_id))
        alerts.extend(await self._get_valorization_alerts(today, now, account_manager_id))
        alerts.extend(await self._get_no_contact_alerts(today, now, account_manager_id))
        return alerts

    async def _get_contract_expiry_alerts(
        self,
        today: date,
        now: datetime,
        account_manager_id: uuid.UUID | None,
    ) -> list[AlertRead]:
        query = (
            select(Contract)
            .join(Customer)
            .where(
                Contract.status != ContractStatus.TERMINATED,
                Contract.deleted_at.is_(None),
                Customer.deleted_at.is_(None),
                Contract.end_date >= today,
                Contract.end_date <= today + timedelta(days=90),
            )
        )
        if account_manager_id:
            query = query.where(Customer.account_manager_id == account_manager_id)

        contracts = (await self.db.execute(query)).scalars().all()
        alerts: list[AlertRead] = []
        for contract in contracts:
            if not contract.end_date:
                continue
            days_left = (contract.end_date - today).days
            for low, high, alert_type, severity, title in _EXPIRY_CONFIG:
                if low <= days_left <= high:
                    alerts.append(AlertRead(
                        id=uuid.uuid4(),
                        type=alert_type,
                        severity=severity,
                        title=title,
                        detail=f"Umowa {contract.contract_number} wygasa za {days_left} dni.",
                        contract_id=contract.id,
                        customer_id=contract.customer_id,
                        due_date=contract.end_date,
                        created_at=now,
                    ))
                    break
        return alerts

    async def _get_valorization_alerts(
        self,
        today: date,
        now: datetime,
        account_manager_id: uuid.UUID | None,
    ) -> list[AlertRead]:
        query = (
            select(Valorization)
            .join(Contract)
            .join(Customer)
            .where(
                Valorization.status != ValorizationStatus.APPROVED,
                Valorization.status != ValorizationStatus.APPLIED,
                Contract.deleted_at.is_(None),
                Customer.deleted_at.is_(None),
            )
        )
        if account_manager_id:
            query = query.where(Customer.account_manager_id == account_manager_id)

        valorizations = (await self.db.execute(query)).scalars().all()
        alerts: list[AlertRead] = []
        for val in valorizations:
            if val.planned_date < today:
                alerts.append(AlertRead(
                    id=uuid.uuid4(),
                    type="valorization_overdue",
                    severity="urgent",
                    title="Zaległa waloryzacja",
                    detail=f"Waloryzacja zaplanowana na {val.planned_date} jest opóźniona.",
                    contract_id=val.contract_id,
                    customer_id=None,
                    due_date=val.planned_date,
                    created_at=now,
                ))
            elif 0 <= (val.planned_date - today).days <= 30 and val.status == ValorizationStatus.PENDING:
                alerts.append(AlertRead(
                    id=uuid.uuid4(),
                    type="valorization_pending",
                    severity="high",
                    title="Zbliżająca się waloryzacja",
                    detail=f"Waloryzacja zaplanowana na {val.planned_date}.",
                    contract_id=val.contract_id,
                    customer_id=None,
                    due_date=val.planned_date,
                    created_at=now,
                ))
        return alerts

    async def _get_no_contact_alerts(
        self,
        today: date,
        now: datetime,
        account_manager_id: uuid.UUID | None,
    ) -> list[AlertRead]:
        cust_query = select(Customer).where(
            Customer.status == CustomerStatus.ACTIVE,
            Customer.deleted_at.is_(None),
        )
        if account_manager_id:
            cust_query = cust_query.where(Customer.account_manager_id == account_manager_id)

        customers = (await self.db.execute(cust_query)).scalars().all()
        customer_ids = [cust.id for cust in customers]

        latest_activity: dict[uuid.UUID, datetime] = {}
        if customer_ids:
            activity_query = (
                select(ActivityLog.customer_id, func.max(ActivityLog.activity_date))
                .where(ActivityLog.customer_id.in_(customer_ids))
                .group_by(ActivityLog.customer_id)
            )
            rows = (await self.db.execute(activity_query)).all()
            latest_activity = {row[0]: row[1] for row in rows if row[1] is not None}

        alerts: list[AlertRead] = []
        for cust in customers:
            days_no_contact = self._days_since_contact(cust, today, latest_activity)
            if days_no_contact > 90:
                alerts.append(AlertRead(
                    id=uuid.uuid4(),
                    type="no_contact",
                    severity="medium",
                    title="Brak kontaktu",
                    detail=f"Brak kontaktu z klientem od ponad {days_no_contact} dni.",
                    contract_id=None,
                    customer_id=cust.id,
                    due_date=None,
                    created_at=now,
                ))
        return alerts

    @staticmethod
    def _days_since_contact(
        cust: Customer,
        today: date,
        latest_activity: dict[uuid.UUID, datetime],
    ) -> int:
        latest = latest_activity.get(cust.id)
        if latest:
            last_date = latest.date() if isinstance(latest, datetime) else latest
            return (today - last_date).days
        created = cust.created_at
        if created:
            created_date = created.date() if isinstance(created, datetime) else created
            return (today - created_date).days
        return 91

    async def get_dashboard_kpi(self, account_manager_id: uuid.UUID | None = None) -> DashboardKpi:
        today = date.today()
        thirty_days_ahead = today + timedelta(days=30)

        cust_q = select(func.count(Customer.id)).where(
            Customer.status == CustomerStatus.ACTIVE,
            Customer.deleted_at.is_(None)
        )
        if account_manager_id:
            cust_q = cust_q.where(Customer.account_manager_id == account_manager_id)
        active_customers = (await self.db.execute(cust_q)).scalar() or 0

        cont_q = (
            select(func.count(Contract.id))
            .join(Customer)
            .where(
                Contract.status == ContractStatus.ACTIVE,
                Contract.deleted_at.is_(None),
                Customer.deleted_at.is_(None)
            )
        )
        if account_manager_id:
            cont_q = cont_q.where(Customer.account_manager_id == account_manager_id)
        active_contracts = (await self.db.execute(cont_q)).scalar() or 0

        exp_q = (
            select(func.count(Contract.id))
            .join(Customer)
            .where(
                Contract.status != ContractStatus.TERMINATED,
                Contract.deleted_at.is_(None),
                Customer.deleted_at.is_(None),
                Contract.end_date >= today,
                Contract.end_date <= thirty_days_ahead,
            )
        )
        if account_manager_id:
            exp_q = exp_q.where(Customer.account_manager_id == account_manager_id)
        contracts_expiring_30d = (await self.db.execute(exp_q)).scalar() or 0

        val_pend_q = (
            select(func.count(Valorization.id))
            .join(Contract)
            .join(Customer)
            .where(
                Contract.deleted_at.is_(None),
                Customer.deleted_at.is_(None),
                Valorization.status == ValorizationStatus.PENDING,
                Valorization.planned_date >= today,
                Valorization.planned_date <= thirty_days_ahead,
            )
        )
        if account_manager_id:
            val_pend_q = val_pend_q.where(Customer.account_manager_id == account_manager_id)
        valorizations_pending = (await self.db.execute(val_pend_q)).scalar() or 0

        val_over_q = (
            select(func.count(Valorization.id))
            .join(Contract)
            .join(Customer)
            .where(
                Contract.deleted_at.is_(None),
                Customer.deleted_at.is_(None),
                Valorization.status != ValorizationStatus.APPROVED,
                Valorization.status != ValorizationStatus.APPLIED,
                Valorization.planned_date < today,
            )
        )
        if account_manager_id:
            val_over_q = val_over_q.where(Customer.account_manager_id == account_manager_id)
        valorizations_overdue = (await self.db.execute(val_over_q)).scalar() or 0

        return DashboardKpi(
            active_customers=active_customers,
            active_contracts=active_contracts,
            contracts_expiring_30d=contracts_expiring_30d,
            valorizations_pending=valorizations_pending,
            valorizations_overdue=valorizations_overdue,
        )
