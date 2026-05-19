"""Schemas for AI-assisted document generation."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DocumentGenerationStatus, DocumentTone, IndexType
from app.schemas.common import ORMBaseSchema


# ── Template registry ────────────────────────────────────────────────────────


class DocumentTemplateRead(BaseModel):
    """Public description of a registered template — drives the wizard UI."""

    key: str
    version: str
    title: str
    description: str
    output_document_type: str
    creates_amendment: bool = False
    params_schema: dict[str, Any]


# ── Per-service input + simulation ───────────────────────────────────────────


class ValorizationServiceInput(BaseModel):
    """Optional override for a single ContractService in the wizard."""

    contract_service_id: uuid.UUID
    include: bool = True
    custom_index_pct: Decimal | None = None  # nadpisuje globalny index dla tej usługi


class ServiceSimulation(BaseModel):
    """Per-service computed financial impact of valorization."""

    contract_service_id: uuid.UUID
    service_name: str
    current_base_price: Decimal
    discount_pct: Decimal
    current_effective_price: Decimal
    applied_index_pct: Decimal
    proposed_base_price: Decimal
    proposed_effective_price: Decimal
    delta_per_period: Decimal
    delta_yearly: Decimal
    billing_cycle: str | None
    billing_unit: str | None


class SimulationSummary(BaseModel):
    """Roll-up totals across all services in scope."""

    services: list[ServiceSimulation]
    current_annual_revenue: Decimal
    proposed_annual_revenue: Decimal
    delta_annual_revenue: Decimal
    delta_annual_revenue_pct: Decimal
    weighted_avg_index_pct: Decimal


# ── Generation request payloads ──────────────────────────────────────────────


class ValorizationParams(BaseModel):
    """Parameters for the ``amendment_valorization_v1`` template."""

    year: int = Field(ge=2020, le=2100)
    index_type: IndexType
    index_value: Decimal = Field(ge=Decimal("-50"), le=Decimal("100"))
    effective_date: date
    services: list[ValorizationServiceInput] = Field(default_factory=list)


class GenerationRequest(BaseModel):
    """Common request body for preview + finalize endpoints."""

    template_key: str
    customer_id: uuid.UUID
    contract_id: uuid.UUID | None = None
    params: ValorizationParams

    # Free-form user instructions to steer the LLM (cover letter + rationale).
    # Numbers and legal clauses are NEVER taken from this — only narrative tone & emphasis.
    user_instructions: str | None = Field(default=None, max_length=2000)
    tone: DocumentTone = DocumentTone.NEUTRAL
    include_cover_letter: bool = True
    include_ai_rationale: bool = True


# ── Preview / finalize responses ─────────────────────────────────────────────


class GenerationPreviewResponse(BaseModel):
    """What the wizard step 3-4 needs to render the preview."""

    simulation: SimulationSummary
    rendered_html: str  # full HTML — wizard renders inside <iframe srcDoc=...>
    cover_letter_text: str | None = None
    rationale_bullets: list[str] = Field(default_factory=list)
    template_key: str
    template_version: str


class GenerationRead(ORMBaseSchema):
    """Persisted generation record."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID
    contract_id: uuid.UUID | None
    amendment_id: uuid.UUID | None
    attachment_pdf_id: uuid.UUID | None
    cover_letter_attachment_id: uuid.UUID | None
    template_key: str
    template_version: str
    status: DocumentGenerationStatus
    payload: dict
    simulation: dict
    ai_artifacts: dict
    pdf_sha256: str | None
    generated_by: uuid.UUID | None
    accepted_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class GenerationAccept(BaseModel):
    """User confirms the previewed PDF is OK to use / send."""

    accepted_by: uuid.UUID
