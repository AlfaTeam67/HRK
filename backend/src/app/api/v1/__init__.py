from fastapi import APIRouter

from app.api.v1.alerts import router as alerts_router
from app.api.v1.auth import router as auth_router
from app.api.v1.companies import router as companies_router
from app.api.v1.customers import router as customers_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.documents import router as documents_router
from app.api.v1.rag import router as rag_router
from app.api.v1.users import router as users_router

api_router = APIRouter()
api_router.include_router(alerts_router, prefix="/alerts", tags=["alerts"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(companies_router, prefix="/companies", tags=["companies"])
api_router.include_router(customers_router, prefix="/customers", tags=["customers"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(rag_router, prefix="/rag", tags=["rag"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
