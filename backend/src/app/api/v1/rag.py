"""RAG endpoints — document search for a given customer."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthorizationService, get_current_user
from app.core.database import get_db
from app.models.user import User
from app.repo.customer import CustomerRepository
from app.schemas.rag import RagSearchRequest, RagSearchResponse
from app.service.embedding import EmbeddingService
from app.service.llm import LLMService
from app.service.rag import RAGService

router = APIRouter()


@router.post("/search", response_model=RagSearchResponse)
async def search_documents(
    req: RagSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    customer = await CustomerRepository(db).get(req.customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    authorization = AuthorizationService(db)
    try:
        await authorization.authorize_by_policy(
            user=current_user,
            resource="rag",
            action="query",
            resource_company_id=customer.company_id,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "AUTHORIZATION_DENIED", "message": str(exc)},
        ) from exc

    service = RAGService(EmbeddingService(), LLMService())
    return await service.search(req, db)
