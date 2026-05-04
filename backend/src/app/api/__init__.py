"""Application API package and composed router."""

from fastapi import APIRouter, Depends

from app.api.activity import router as activity_router
from app.api.contact_persons import router as contact_persons_router
from app.api.contracts import router as contracts_router
from app.api.customer_rates import router as customer_rates_router
from app.api.customers import router as customers_router
from app.api.notes import router as notes_router
from app.api.service_groups import router as service_groups_router
from app.api.services import router as services_router
from app.api.valorizations import router as valorizations_router
from app.core.auth import get_current_user

api_router = APIRouter()

api_router.include_router(contracts_router, dependencies=[Depends(get_current_user)])
api_router.include_router(activity_router, dependencies=[Depends(get_current_user)])
api_router.include_router(customer_rates_router, dependencies=[Depends(get_current_user)])
api_router.include_router(customers_router, dependencies=[Depends(get_current_user)])
api_router.include_router(notes_router, dependencies=[Depends(get_current_user)])
api_router.include_router(service_groups_router, dependencies=[Depends(get_current_user)])
api_router.include_router(services_router, dependencies=[Depends(get_current_user)])
api_router.include_router(valorizations_router, dependencies=[Depends(get_current_user)])
api_router.include_router(contact_persons_router, dependencies=[Depends(get_current_user)])
