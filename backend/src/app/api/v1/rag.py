"""RAG endpoints — document search for a given customer."""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.rag import RagSearchRequest, RagSearchResponse
from app.service.embedding import EmbeddingService
from app.service.llm import LLMService
from app.service.rag import RAGService
from app.service.reranker_client import RerankerClient

router = APIRouter()


@router.post("/search", response_model=RagSearchResponse)
async def search_documents(req: RagSearchRequest, db: AsyncSession = Depends(get_db)) -> Any:
    service = RAGService(EmbeddingService(), LLMService(), RerankerClient())
    return await service.search(req, db)
