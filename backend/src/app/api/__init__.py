"""Application API package and composed router."""

from fastapi import APIRouter

from app.api.contracts import router as contracts_router
from app.api.customers import router as customers_router
from app.api.services import router as services_router

api_router = APIRouter()
api_router.include_router(customers_router)
api_router.include_router(contracts_router)
api_router.include_router(services_router)
