"""Application API routers."""

from fastapi import APIRouter

from app.api.crm import router as crm_router

api_router = APIRouter()
api_router.include_router(crm_router)
