"""Reports service — role-based activity log aggregation."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ActivityType
from app.repo.activity import ActivityLogRepository
from app.repo.user import UserRepository
from app.schemas.activity import ActivityLogReportResponse

_ADMIN_DEPARTMENTS = {"Administrator IT", "HRK\\Administrator", "Administrator"}


class ReportsService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._activity_repo = ActivityLogRepository(db)
        self._user_repo = UserRepository(db)

    async def get_activity_report(
        self,
        *,
        current_user_id: uuid.UUID,
        period_days: int,
        filter_user_id: uuid.UUID | None,
        customer_id: uuid.UUID | None,
        activity_type: ActivityType | None,
        limit: int,
        offset: int,
    ) -> ActivityLogReportResponse:
        user = await self._user_repo.get(current_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        is_admin = user.department in _ADMIN_DEPARTMENTS

        if is_admin:
            items, total = await self._activity_repo.list_for_admin(
                current_user_id=current_user_id,
                period_days=period_days,
                filter_user_id=filter_user_id,
                customer_id=customer_id,
                activity_type=activity_type,
                limit=limit,
                offset=offset,
            )
            kpi = await self._activity_repo.get_kpi_admin(
                period_days=period_days,
                filter_user_id=filter_user_id,
                customer_id=customer_id,
                activity_type=activity_type,
            )
        else:
            items, total = await self._activity_repo.list_for_user_scope(
                current_user_id=current_user_id,
                period_days=period_days,
                customer_id=customer_id,
                activity_type=activity_type,
                limit=limit,
                offset=offset,
            )
            kpi = await self._activity_repo.get_kpi_user_scope(
                current_user_id=current_user_id,
                period_days=period_days,
                customer_id=customer_id,
                activity_type=activity_type,
            )

        return ActivityLogReportResponse(items=items, kpi=kpi, total=total)
