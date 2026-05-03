import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog
from app.models.contract import Contract
from app.models.customer import Customer
from app.models.enums import ContractStatus, CustomerStatus, ValorizationStatus
from app.models.rate import Valorization
from app.schemas.alert import AlertRead
from app.schemas.dashboard import DashboardKpi


class AlertService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_alerts(self, account_manager_id: uuid.UUID | None = None) -> list[AlertRead]:
        alerts: list[AlertRead] = []
        today = date.today()
        now = datetime.now(timezone.utc)

        # 1. Contract expiry 30/60/90
        contract_query = select(Contract).where(Contract.status != ContractStatus.TERMINATED)
        if account_manager_id:
            contract_query = contract_query.join(Customer).where(
                Customer.account_manager_id == account_manager_id
            )

        contracts = (await self.db.execute(contract_query)).scalars().all()
        for contract in contracts:
            if contract.end_date:
                days_left = (contract.end_date - today).days
                if 0 <= days_left <= 30:
                    alerts.append(
                        AlertRead(
                            id=uuid.uuid4(),
                            type="contract_expiry_30",
                            severity="urgent",
                            title="Wygasająca umowa (30 dni)",
                            detail=f"Umowa {contract.contract_number} wygasa za {days_left} dni.",
                            contract_id=contract.id,
                            customer_id=contract.customer_id,
                            due_date=contract.end_date,
                            created_at=now,
                        )
                    )
                elif 30 < days_left <= 60:
                    alerts.append(
                        AlertRead(
                            id=uuid.uuid4(),
                            type="contract_expiry_60",
                            severity="high",
                            title="Wygasająca umowa (60 dni)",
                            detail=f"Umowa {contract.contract_number} wygasa za {days_left} dni.",
                            contract_id=contract.id,
                            customer_id=contract.customer_id,
                            due_date=contract.end_date,
                            created_at=now,
                        )
                    )
                elif 60 < days_left <= 90:
                    alerts.append(
                        AlertRead(
                            id=uuid.uuid4(),
                            type="contract_expiry_90",
                            severity="medium",
                            title="Wygasająca umowa (90 dni)",
                            detail=f"Umowa {contract.contract_number} wygasa za {days_left} dni.",
                            contract_id=contract.id,
                            customer_id=contract.customer_id,
                            due_date=contract.end_date,
                            created_at=now,
                        )
                    )

        # 2. Valorization overdue / pending
        val_query = select(Valorization).where(
            Valorization.status != ValorizationStatus.APPROVED,
            Valorization.status != ValorizationStatus.APPLIED,
        )
        if account_manager_id:
            val_query = val_query.join(Contract).join(Customer).where(
                Customer.account_manager_id == account_manager_id
            )

        valorizations = (await self.db.execute(val_query)).scalars().all()
        for val in valorizations:
            if val.planned_date < today:
                alerts.append(
                    AlertRead(
                        id=uuid.uuid4(),
                        type="valorization_overdue",
                        severity="urgent",
                        title="Zaległa waloryzacja",
                        detail=f"Waloryzacja zaplanowana na {val.planned_date} jest opóźniona.",
                        contract_id=val.contract_id,
                        customer_id=None,
                        due_date=val.planned_date,
                        created_at=now,
                    )
                )
            elif 0 <= (val.planned_date - today).days <= 30 and val.status == ValorizationStatus.PENDING:
                alerts.append(
                    AlertRead(
                        id=uuid.uuid4(),
                        type="valorization_pending",
                        severity="high",
                        title="Zbliżająca się waloryzacja",
                        detail=f"Waloryzacja zaplanowana na {val.planned_date}.",
                        contract_id=val.contract_id,
                        customer_id=None,
                        due_date=val.planned_date,
                        created_at=now,
                    )
                )

        # 3. No contact (> 90 days)
        cust_query = select(Customer).where(Customer.status == CustomerStatus.ACTIVE)
        if account_manager_id:
            cust_query = cust_query.where(Customer.account_manager_id == account_manager_id)

        customers = (await self.db.execute(cust_query)).scalars().all()
        for cust in customers:
            act_query = select(func.max(ActivityLog.activity_date)).where(ActivityLog.customer_id == cust.id)
            latest_act_dt = (await self.db.execute(act_query)).scalar()
            
            days_no_contact = 0
            if latest_act_dt:
                today_dt = datetime.now(latest_act_dt.tzinfo or timezone.utc)
                days_no_contact = (today_dt - latest_act_dt).days
            else:
                cust_tz = getattr(cust.created_at, "tzinfo", timezone.utc) or timezone.utc
                today_dt = datetime.now(cust_tz)
                days_no_contact = (today_dt - cust.created_at).days if cust.created_at else 91

            if days_no_contact > 90:
                alerts.append(
                    AlertRead(
                        id=uuid.uuid4(),
                        type="no_contact",
                        severity="medium",
                        title="Brak kontaktu",
                        detail=f"Brak kontaktu z klientem od ponad {days_no_contact} dni.",
                        contract_id=None,
                        customer_id=cust.id,
                        due_date=None,
                        created_at=now,
                    )
                )

        return alerts

    async def get_dashboard_kpi(self, account_manager_id: uuid.UUID | None = None) -> DashboardKpi:
        today = date.today()
        thirty_days_ahead = today + timedelta(days=30)

        cust_q = select(func.count(Customer.id)).where(Customer.status == CustomerStatus.ACTIVE)
        if account_manager_id:
            cust_q = cust_q.where(Customer.account_manager_id == account_manager_id)
        active_customers = (await self.db.execute(cust_q)).scalar() or 0

        cont_q = select(func.count(Contract.id)).where(Contract.status == ContractStatus.ACTIVE)
        if account_manager_id:
            cont_q = cont_q.join(Customer).where(Customer.account_manager_id == account_manager_id)
        active_contracts = (await self.db.execute(cont_q)).scalar() or 0

        exp_q = select(func.count(Contract.id)).where(
            Contract.status != ContractStatus.TERMINATED,
            Contract.end_date >= today,
            Contract.end_date <= thirty_days_ahead,
        )
        if account_manager_id:
            exp_q = exp_q.join(Customer).where(Customer.account_manager_id == account_manager_id)
        contracts_expiring_30d = (await self.db.execute(exp_q)).scalar() or 0

        val_pend_q = select(func.count(Valorization.id)).where(
            Valorization.status == ValorizationStatus.PENDING,
            Valorization.planned_date >= today,
            Valorization.planned_date <= thirty_days_ahead,
        )
        if account_manager_id:
            val_pend_q = val_pend_q.join(Contract).join(Customer).where(Customer.account_manager_id == account_manager_id)
        valorizations_pending = (await self.db.execute(val_pend_q)).scalar() or 0

        val_over_q = select(func.count(Valorization.id)).where(
            Valorization.status != ValorizationStatus.APPROVED,
            Valorization.status != ValorizationStatus.APPLIED,
            Valorization.planned_date < today,
        )
        if account_manager_id:
            val_over_q = val_over_q.join(Contract).join(Customer).where(Customer.account_manager_id == account_manager_id)
        valorizations_overdue = (await self.db.execute(val_over_q)).scalar() or 0

        return DashboardKpi(
            active_customers=active_customers,
            active_contracts=active_contracts,
            contracts_expiring_30d=contracts_expiring_30d,
            valorizations_pending=valorizations_pending,
            valorizations_overdue=valorizations_overdue,
        )
