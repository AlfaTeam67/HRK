"""CustomerRate business service."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.rate import CustomerRate
from app.repo.customer_rates import CustomerRateRepository
from app.schemas.customer_rates import CustomerRateCreate, CustomerRateUpdate


class CustomerRateCrudService:
    """Business operations for customer rates."""

    def __init__(self, rate_repo: CustomerRateRepository) -> None:
        self.rates = rate_repo

    async def list_rates(self) -> list[CustomerRate]:
        return await self.rates.list()

    async def get_rate(self, rate_id: uuid.UUID) -> CustomerRate:
        rate = await self.rates.get(rate_id)
        if not rate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CustomerRate not found")
        return rate

    async def create_rate(self, payload: CustomerRateCreate) -> CustomerRate:
        data = payload.model_dump()
        try:
            return await self.rates.create(data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="CustomerRate create failed due to constraint violation",
            ) from exc

    async def update_rate(self, rate_id: uuid.UUID, payload: CustomerRateUpdate) -> CustomerRate:
        rate = await self.get_rate(rate_id)
        data = payload.model_dump(exclude_unset=True)
        try:
            return await self.rates.update(rate, data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="CustomerRate update failed due to constraint violation",
            ) from exc

    async def delete_rate(self, rate_id: uuid.UUID) -> None:
        rate = await self.get_rate(rate_id)
        try:
            await self.rates.delete(rate)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="CustomerRate delete failed due to constraint violation",
            ) from exc
