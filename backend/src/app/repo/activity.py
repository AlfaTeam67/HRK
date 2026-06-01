"""Activity log repository."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog
from app.models.contract import Contract
from app.models.customer import Customer
from app.models.enums import ActivityType
from app.models.user import User
from app.schemas.activity import ActivityKPI, ActivityLogReportItem


class ActivityLogRepository:
    """Data access for ActivityLog model."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_customer(
        self, customer_id: uuid.UUID, limit: int, offset: int
    ) -> list[ActivityLog]:
        stmt = (
            select(ActivityLog)
            .where(ActivityLog.customer_id == customer_id)
            .order_by(ActivityLog.activity_date.desc(), ActivityLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_contract(
        self, contract_id: uuid.UUID, limit: int, offset: int
    ) -> list[ActivityLog]:
        stmt = (
            select(ActivityLog)
            .where(ActivityLog.contract_id == contract_id)
            .order_by(ActivityLog.activity_date.desc(), ActivityLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict[str, Any], performed_by: uuid.UUID | None) -> ActivityLog:
        payload = dict(data)
        payload["performed_by"] = performed_by

        activity = ActivityLog(**payload)
        self.db.add(activity)
        await self.db.flush()
        await self.db.refresh(activity)
        return activity

    def _period_cutoff(self, period_days: int) -> datetime:
        return datetime.now(UTC) - timedelta(days=period_days)

    def _apply_common_filters(
        self,
        stmt: Any,
        *,
        period_days: int,
        customer_id: uuid.UUID | None,
        activity_type: ActivityType | None,
    ) -> Any:
        stmt = stmt.where(ActivityLog.activity_date >= self._period_cutoff(period_days))
        if customer_id is not None:
            stmt = stmt.where(ActivityLog.customer_id == customer_id)
        if activity_type is not None:
            stmt = stmt.where(ActivityLog.activity_type == activity_type)
        return stmt

    async def list_for_admin(
        self,
        *,
        current_user_id: uuid.UUID,
        period_days: int,
        filter_user_id: uuid.UUID | None,
        customer_id: uuid.UUID | None,
        activity_type: ActivityType | None,
        limit: int,
        offset: int,
    ) -> tuple[list[ActivityLogReportItem], int]:
        base = select(ActivityLog, User.login.label("performer_login")).outerjoin(
            User, ActivityLog.performed_by == User.id
        )
        base = self._apply_common_filters(
            base, period_days=period_days, customer_id=customer_id, activity_type=activity_type
        )
        if filter_user_id is not None:
            base = base.where(ActivityLog.performed_by == filter_user_id)

        count_stmt = select(func.count()).select_from(base.subquery())
        total: int = (await self.db.execute(count_stmt)).scalar() or 0

        rows_stmt = base.order_by(
            ActivityLog.activity_date.desc(), ActivityLog.created_at.desc()
        ).limit(limit).offset(offset)
        rows = (await self.db.execute(rows_stmt)).all()

        return [
            ActivityLogReportItem(
                id=row.ActivityLog.id,
                customer_id=row.ActivityLog.customer_id,
                contract_id=row.ActivityLog.contract_id,
                activity_type=row.ActivityLog.activity_type,
                description=row.ActivityLog.description,
                performed_by=row.ActivityLog.performed_by,
                performed_by_login=row.performer_login,
                activity_date=row.ActivityLog.activity_date,
                additional_data=row.ActivityLog.additional_data,
                is_own=(row.ActivityLog.performed_by == current_user_id),
            )
            for row in rows
        ], total

    async def list_for_user_scope(
        self,
        *,
        current_user_id: uuid.UUID,
        period_days: int,
        customer_id: uuid.UUID | None,
        activity_type: ActivityType | None,
        limit: int,
        offset: int,
    ) -> tuple[list[ActivityLogReportItem], int]:
        managed_customer_ids = select(Customer.id).where(
            Customer.account_manager_id == current_user_id,
            Customer.deleted_at.is_(None),
        )
        managed_contract_ids = (
            select(Contract.id)
            .join(Customer, Contract.customer_id == Customer.id)
            .where(
                Customer.account_manager_id == current_user_id,
                Customer.deleted_at.is_(None),
            )
        )

        base = select(ActivityLog, User.login.label("performer_login")).outerjoin(
            User, ActivityLog.performed_by == User.id
        )
        base = self._apply_common_filters(
            base, period_days=period_days, customer_id=customer_id, activity_type=activity_type
        )
        base = base.where(
            or_(
                ActivityLog.performed_by == current_user_id,
                ActivityLog.customer_id.in_(managed_customer_ids),
                ActivityLog.contract_id.in_(managed_contract_ids),
            )
        )

        count_stmt = select(func.count()).select_from(base.subquery())
        total: int = (await self.db.execute(count_stmt)).scalar() or 0

        rows_stmt = base.order_by(
            ActivityLog.activity_date.desc(), ActivityLog.created_at.desc()
        ).limit(limit).offset(offset)
        rows = (await self.db.execute(rows_stmt)).all()

        return [
            ActivityLogReportItem(
                id=row.ActivityLog.id,
                customer_id=row.ActivityLog.customer_id,
                contract_id=row.ActivityLog.contract_id,
                activity_type=row.ActivityLog.activity_type,
                description=row.ActivityLog.description,
                performed_by=row.ActivityLog.performed_by,
                performed_by_login=row.performer_login,
                activity_date=row.ActivityLog.activity_date,
                additional_data=row.ActivityLog.additional_data,
                is_own=(row.ActivityLog.performed_by == current_user_id),
            )
            for row in rows
        ], total

    async def _build_kpi(self, stmt: Any) -> ActivityKPI:
        rows = (await self.db.execute(stmt)).all()
        counts: dict[str, int] = {r.activity_type: r.cnt for r in rows}
        return ActivityKPI(
            events_count=sum(counts.values()),
            meetings_count=counts.get(ActivityType.MEETING, 0) + counts.get(ActivityType.CALL, 0),
            documents_count=counts.get(ActivityType.DOCUMENT, 0),
            notes_count=counts.get(ActivityType.NOTE, 0) + counts.get(ActivityType.EMAIL, 0),
        )

    async def get_kpi_admin(
        self,
        *,
        period_days: int,
        filter_user_id: uuid.UUID | None,
        customer_id: uuid.UUID | None,
        activity_type: ActivityType | None,
    ) -> ActivityKPI:
        stmt = select(ActivityLog.activity_type, func.count().label("cnt")).where(
            ActivityLog.activity_date >= self._period_cutoff(period_days)
        )
        if filter_user_id is not None:
            stmt = stmt.where(ActivityLog.performed_by == filter_user_id)
        if customer_id is not None:
            stmt = stmt.where(ActivityLog.customer_id == customer_id)
        if activity_type is not None:
            stmt = stmt.where(ActivityLog.activity_type == activity_type)
        stmt = stmt.group_by(ActivityLog.activity_type)
        return await self._build_kpi(stmt)

    async def get_kpi_user_scope(
        self,
        *,
        current_user_id: uuid.UUID,
        period_days: int,
        customer_id: uuid.UUID | None,
        activity_type: ActivityType | None,
    ) -> ActivityKPI:
        managed_customer_ids = select(Customer.id).where(
            Customer.account_manager_id == current_user_id,
            Customer.deleted_at.is_(None),
        )
        managed_contract_ids = (
            select(Contract.id)
            .join(Customer, Contract.customer_id == Customer.id)
            .where(
                Customer.account_manager_id == current_user_id,
                Customer.deleted_at.is_(None),
            )
        )
        stmt = select(ActivityLog.activity_type, func.count().label("cnt")).where(
            ActivityLog.activity_date >= self._period_cutoff(period_days),
            or_(
                ActivityLog.performed_by == current_user_id,
                ActivityLog.customer_id.in_(managed_customer_ids),
                ActivityLog.contract_id.in_(managed_contract_ids),
            ),
        )
        if customer_id is not None:
            stmt = stmt.where(ActivityLog.customer_id == customer_id)
        if activity_type is not None:
            stmt = stmt.where(ActivityLog.activity_type == activity_type)
        stmt = stmt.group_by(ActivityLog.activity_type)
        return await self._build_kpi(stmt)
