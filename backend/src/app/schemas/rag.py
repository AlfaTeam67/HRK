"""Pydantic schemas for RAG search."""

from uuid import UUID

from pydantic import BaseModel, Field


class RagSearchRequest(BaseModel):
    customer_id: UUID
    query: str = Field(..., min_length=1, max_length=2000)
    ai_mode: bool = False
    top_k: int = Field(default=5, ge=1, le=20)


class ChunkResult(BaseModel):
    chunk_id: UUID
    attachment_id: UUID
    content: str
    page_number: int | None
    bbox: dict | None
    section_title: str | None
    score: float

    model_config = {"from_attributes": True}


class RagSearchResponse(BaseModel):
    chunks: list[ChunkResult]
    ai_answer: str | None = None
