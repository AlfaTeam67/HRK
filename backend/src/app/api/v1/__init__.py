from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.companies import router as companies_router
from app.api.v1.rag import router as rag_router
from app.api.v1.documents import router as documents_router
from app.api.v1.users import router as users_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(companies_router, prefix="/companies", tags=["companies"])
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(rag_router, prefix="/rag", tags=["rag"])
