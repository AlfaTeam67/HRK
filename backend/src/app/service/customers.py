"""Customer business service."""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.customer import Customer
from app.repo.customers import CustomerRepository
from app.repo.lookups import LookupRepository
from app.schemas.customers import CustomerCreate, CustomerUpdate


class CustomerService:
    """Business operations for customers."""

    def __init__(self, customer_repo: CustomerRepository, lookup_repo: LookupRepository) -> None:
        self.customers = customer_repo
        self.lookup = lookup_repo

    async def list_customers(self, **kwargs) -> list[Customer]:
        return await self.customers.list(**kwargs)

    async def get_customer(self, customer_id: uuid.UUID) -> Customer:
        customer = await self.customers.get(customer_id)
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        return customer

    async def create_customer(self, payload: CustomerCreate) -> Customer:
        data = payload.model_dump()
        await self._validate_customer_refs(data)
        try:
            return await self.customers.create(data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Customer with provided identifiers already exists",
            ) from exc

    async def update_customer(self, customer_id: uuid.UUID, payload: CustomerUpdate) -> Customer:
        customer = await self.get_customer(customer_id)
        data = payload.model_dump(exclude_unset=True)
        await self._validate_customer_refs(data)
        try:
            return await self.customers.update(customer, data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Customer update violates unique constraints",
            ) from exc

    async def delete_customer(self, customer_id: uuid.UUID) -> None:
        customer = await self.get_customer(customer_id)
        if await self.lookup.has_customer_contracts(customer_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Customer has active contracts and cannot be deleted",
            )
        await self.customers.update(customer, {"deleted_at": datetime.now(UTC)})

    async def _validate_customer_refs(self, data: dict) -> None:
        company_id = data.get("company_id")
        if company_id and not await self.lookup.company_exists(company_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found",
            )

        account_manager_id = data.get("account_manager_id")
        if account_manager_id and not await self.lookup.user_exists(account_manager_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account manager not found",
            )
