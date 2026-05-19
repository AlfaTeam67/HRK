"""Orchestration service for AI-assisted document generation.

Layered flow stays intact:
    API router → DocumentGenerationService → repositories → SQLAlchemy.

The service composes:
- ValorizationContextRepository (read-only joins for customer/contract/services)
- ValorizationSimulator (pure financial math)
- TemplateRegistry (Jinja2 HTML)
- LLMService (cover letter + rationale, narrative only)
- PdfRenderer (HTML → PDF)
- StorageService (S3 upload of finalized PDFs)
- AttachmentRepository / DocumentGenerationRepository (persistence)

The numbers in the produced PDF always come from the simulator. The LLM
contributes only narrative (cover letter, rationale bullets).
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import DocumentStorageError
from app.models.contract import Contract
from app.models.customer import Customer
from app.models.document_generation import DocumentGeneration
from app.models.enums import (
    ActivityType,
    DocumentGenerationStatus,
    DocumentType,
)
from app.repo.activity import ActivityLogRepository
from app.repo.attachment import AttachmentRepository
from app.repo.contracts import ContractRepository
from app.repo.document_generation import (
    DocumentGenerationRepository,
    ValorizationContextRepository,
)
from app.schemas.document_generation import (
    GenerationPreviewResponse,
    GenerationRequest,
    SimulationSummary,
    ValorizationParams,
)
from app.service.document_generation.pdf import PdfRenderer
from app.service.document_generation.simulator import simulate_valorization
from app.service.document_generation.templates import (
    TemplateNotFoundError,
    TemplateRegistry,
    get_template_registry,
)
from app.service.llm import LLMService
from app.service.storage import StorageService, StorageServiceError

logger = logging.getLogger(__name__)


class DocumentGenerationService:
    """Coordinator for preview + finalize + accept flows."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        registry: TemplateRegistry | None = None,
        renderer: PdfRenderer | None = None,
        storage: StorageService | None = None,
        llm: LLMService | None = None,
    ) -> None:
        self._session = session
        self._gen_repo = DocumentGenerationRepository(session)
        self._ctx_repo = ValorizationContextRepository(session)
        self._contract_repo = ContractRepository(session)
        self._attachment_repo = AttachmentRepository(session)
        self._activity_repo = ActivityLogRepository(session)
        self._registry = registry or get_template_registry()
        self._renderer = renderer or PdfRenderer()
        self._storage = storage or StorageService()
        self._llm = llm or LLMService()

    # ── Public API ───────────────────────────────────────────────────────────

    async def list_templates(self) -> list[Any]:
        return list(self._registry.list_templates())

    async def list_for_customer(self, customer_id: uuid.UUID) -> list[DocumentGeneration]:
        return await self._gen_repo.list_by_customer(customer_id)

    async def get(self, generation_id: uuid.UUID) -> DocumentGeneration:
        gen = await self._gen_repo.get(generation_id)
        if not gen:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Generation not found")
        return gen

    async def preview(self, request: GenerationRequest) -> GenerationPreviewResponse:
        """Build simulation + HTML. Does NOT touch S3 or DB.

        LLM (rationale, cover letter) is intentionally skipped here so that the
        live preview stays fast. Both are produced on ``finalize`` instead.
        """
        context, simulation = await self._build_context_and_simulation(request)
        manifest = self._registry.get_manifest(request.template_key)

        rendered_html = self._registry.render_main(
            request.template_key,
            self._build_template_context(
                generation_id=None,
                request=request,
                context=context,
                simulation=simulation,
                rationale_bullets=[],
                draft=True,
                amendment_number=self._next_amendment_number(context["contract"]),
                amendment_date=date.today(),
            ),
        )
        return GenerationPreviewResponse(
            simulation=simulation,
            rendered_html=rendered_html,
            cover_letter_text=None,
            rationale_bullets=[],
            template_key=request.template_key,
            template_version=str(manifest["version"]),
        )

    async def finalize(
        self,
        request: GenerationRequest,
        *,
        generated_by: uuid.UUID,
    ) -> DocumentGeneration:
        """Render PDF (with DRAFT watermark), upload to S3, persist record.

        Status after this step is ``preview`` — user still has to ``accept``
        before the document can be sent. Acceptance removes the draft
        watermark and re-uploads the clean PDF.
        """
        context, simulation = await self._build_context_and_simulation(request)
        manifest = self._registry.get_manifest(request.template_key)
        template_version = str(manifest["version"])
        amendment_number = self._next_amendment_number(context["contract"])
        amendment_date = date.today()

        rationale_bullets: list[str] = []
        cover_letter_text: str | None = None
        facts = self._build_llm_facts(
            customer=context["customer"],
            contract=context["contract"],
            simulation=simulation,
            params=request.params,
        )

        if request.include_ai_rationale:
            try:
                rationale_bullets = await self._llm.generate_rationale_bullets(
                    facts=facts,
                    tone=request.tone.value,
                    user_instructions=request.user_instructions,
                )
            except Exception:  # noqa: BLE001
                logger.exception("LLM rationale generation failed during finalize")

        if request.include_cover_letter:
            try:
                cover_letter_text = await self._llm.generate_cover_letter(
                    facts=facts,
                    tone=request.tone.value,
                    user_instructions=request.user_instructions,
                )
            except Exception:  # noqa: BLE001
                logger.exception("LLM cover letter generation failed during finalize")

        generation_id = uuid.uuid4()

        # Render main amendment with DRAFT watermark first.
        amendment_html = self._registry.render_main(
            request.template_key,
            self._build_template_context(
                generation_id=generation_id,
                request=request,
                context=context,
                simulation=simulation,
                rationale_bullets=rationale_bullets,
                draft=True,
                amendment_number=amendment_number,
                amendment_date=amendment_date,
            ),
        )
        amendment_pdf = await self._renderer.render(amendment_html)
        safe_amendment_no = self._safe_filename(amendment_number)
        safe_contract_no = self._safe_filename(context["contract"].contract_number)
        amendment_attachment = await self._upload_pdf(
            pdf=amendment_pdf,
            customer=context["customer"],
            contract=context["contract"],
            document_type=DocumentType.AMENDMENT,
            filename=f"aneks_{safe_amendment_no}_{safe_contract_no}_DRAFT.pdf",
            uploaded_by=generated_by,
        )

        cover_letter_attachment = None
        if cover_letter_text:
            cover_html = self._registry.render_cover_letter(
                request.template_key,
                self._build_template_context(
                    generation_id=generation_id,
                    request=request,
                    context=context,
                    simulation=simulation,
                    rationale_bullets=rationale_bullets,
                    draft=True,
                    amendment_number=amendment_number,
                    amendment_date=amendment_date,
                    extra={"cover_letter_text": cover_letter_text},
                ),
            )
            cover_pdf = await self._renderer.render(cover_html)
            cover_letter_attachment = await self._upload_pdf(
                pdf=cover_pdf,
                customer=context["customer"],
                contract=context["contract"],
                document_type=DocumentType.COVER_LETTER,
                filename=f"pismo_przewodnie_{safe_amendment_no}_DRAFT.pdf",
                uploaded_by=generated_by,
            )

        gen = await self._gen_repo.create(
            {
                "id": generation_id,
                "customer_id": request.customer_id,
                "contract_id": request.contract_id,
                "attachment_pdf_id": amendment_attachment.id,
                "cover_letter_attachment_id": (
                    cover_letter_attachment.id if cover_letter_attachment else None
                ),
                "template_key": request.template_key,
                "template_version": template_version,
                "status": DocumentGenerationStatus.PREVIEW,
                "payload": _serializable(
                    {
                        "request": request.model_dump(mode="json"),
                        "amendment_number": amendment_number,
                        "amendment_date": amendment_date.isoformat(),
                    }
                ),
                "simulation": _serializable(simulation.model_dump(mode="json")),
                "ai_artifacts": {
                    "rationale_bullets": rationale_bullets,
                    "cover_letter_text": cover_letter_text,
                    "model": settings.openrouter_model,
                    "tone": request.tone.value,
                    "prompt_hash": _hash_facts(facts, request.user_instructions),
                },
                "pdf_sha256": PdfRenderer.sha256(amendment_pdf),
                "generated_by": generated_by,
            }
        )

        await self._activity_repo.create(
            {
                "customer_id": request.customer_id,
                "contract_id": request.contract_id,
                "activity_type": ActivityType.DOCUMENT,
                "description": (
                    f"Wygenerowano draft aneksu {amendment_number}. "
                    f"Indeks {request.params.index_value}% · "
                    f"Δ rok: {simulation.delta_annual_revenue} zł · "
                    f"do akceptacji opiekuna."
                ),
            },
            performed_by=generated_by,
        )
        await self._session.commit()
        return gen

    async def accept(
        self,
        generation_id: uuid.UUID,
        *,
        accepted_by: uuid.UUID,
    ) -> DocumentGeneration:
        """Re-render without DRAFT watermark, replace S3 object, mark accepted."""
        gen = await self.get(generation_id)
        if gen.status not in (
            DocumentGenerationStatus.PREVIEW,
            DocumentGenerationStatus.DRAFT,
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"Generation cannot be accepted from status '{gen.status.value}'",
            )

        request = GenerationRequest(**gen.payload["request"])
        context, simulation = await self._build_context_and_simulation(request)
        amendment_number = gen.payload["amendment_number"]
        amendment_date = date.fromisoformat(gen.payload["amendment_date"])
        rationale_bullets = gen.ai_artifacts.get("rationale_bullets") or []
        cover_letter_text = gen.ai_artifacts.get("cover_letter_text")

        clean_html = self._registry.render_main(
            request.template_key,
            self._build_template_context(
                generation_id=gen.id,
                request=request,
                context=context,
                simulation=simulation,
                rationale_bullets=rationale_bullets,
                draft=False,
                amendment_number=amendment_number,
                amendment_date=amendment_date,
            ),
        )
        clean_pdf = await self._renderer.render(clean_html)
        safe_amendment_no = self._safe_filename(amendment_number)
        safe_contract_no = self._safe_filename(context["contract"].contract_number)
        await self._replace_pdf(
            attachment_id=gen.attachment_pdf_id,
            pdf=clean_pdf,
            new_filename=f"aneks_{safe_amendment_no}_{safe_contract_no}.pdf",
        )

        if cover_letter_text and gen.cover_letter_attachment_id:
            cover_html = self._registry.render_cover_letter(
                request.template_key,
                self._build_template_context(
                    generation_id=gen.id,
                    request=request,
                    context=context,
                    simulation=simulation,
                    rationale_bullets=rationale_bullets,
                    draft=False,
                    amendment_number=amendment_number,
                    amendment_date=amendment_date,
                    extra={"cover_letter_text": cover_letter_text},
                ),
            )
            cover_pdf = await self._renderer.render(cover_html)
            await self._replace_pdf(
                attachment_id=gen.cover_letter_attachment_id,
                pdf=cover_pdf,
                new_filename=f"pismo_przewodnie_{safe_amendment_no}.pdf",
            )

        gen = await self._gen_repo.update(
            gen,
            {
                "status": DocumentGenerationStatus.ACCEPTED,
                "accepted_by": accepted_by,
                "pdf_sha256": PdfRenderer.sha256(clean_pdf),
            },
        )
        await self._activity_repo.create(
            {
                "customer_id": gen.customer_id,
                "contract_id": gen.contract_id,
                "activity_type": ActivityType.DOCUMENT,
                "description": (
                    f"Zaakceptowano aneks {amendment_number}. "
                    "Dokument gotowy do wysyłki do klienta."
                ),
            },
            performed_by=accepted_by,
        )
        await self._session.commit()
        return gen

    async def reject(self, generation_id: uuid.UUID, *, rejected_by: uuid.UUID) -> None:
        gen = await self.get(generation_id)
        await self._gen_repo.update(gen, {"status": DocumentGenerationStatus.REJECTED})
        await self._activity_repo.create(
            {
                "customer_id": gen.customer_id,
                "contract_id": gen.contract_id,
                "activity_type": ActivityType.DOCUMENT,
                "description": f"Odrzucono draft dokumentu (generacja {gen.id}).",
            },
            performed_by=rejected_by,
        )
        await self._session.commit()

    # ── Internal helpers ─────────────────────────────────────────────────────

    async def _build_context_and_simulation(
        self, request: GenerationRequest
    ) -> tuple[dict[str, Any], SimulationSummary]:
        try:
            self._registry.get_manifest(request.template_key)
        except TemplateNotFoundError as exc:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc

        if request.contract_id is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="contract_id is required for valorization amendments",
            )

        customer = await self._ctx_repo.get_customer_with_company(request.customer_id)
        if customer is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Customer not found")

        contract = await self._ctx_repo.get_contract_with_services(request.contract_id)
        if contract is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                detail=(
                    f"Contract {request.contract_id} not found "
                    "(may be soft-deleted or wrong id)"
                ),
            )
        if contract.customer_id != customer.id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Contract {contract.id} belongs to customer "
                    f"{contract.customer_id}, not to {customer.id}"
                ),
            )

        contract_service_ids = [cs.id for cs in contract.contract_services]
        rates = await self._ctx_repo.get_rates_for_services(
            contract_service_ids, year=request.params.year - 1
        )
        service_names = await self._ctx_repo.get_service_names(
            [cs.service_id for cs in contract.contract_services]
        )
        simulation = simulate_valorization(
            contract=contract,
            rates_by_cs=rates,
            service_names=service_names,
            params=request.params,
        )
        return ({"customer": customer, "contract": contract}, simulation)

    @staticmethod
    def _build_llm_facts(
        *,
        customer: Customer,
        contract: Contract,
        simulation: SimulationSummary,
        params: ValorizationParams,
    ) -> dict[str, Any]:
        return {
            "Nazwa klienta": customer.company.name if customer.company else customer.ckk,
            "Numer umowy": contract.contract_number,
            "Data zawarcia umowy": contract.start_date.isoformat(),
            "Rok waloryzacji": params.year,
            "Typ indeksacji": params.index_type.value,
            "Wartość indeksacji [%]": str(params.index_value),
            "Data wejścia w życie": params.effective_date.isoformat(),
            "Liczba usług w zakresie": len(simulation.services),
            "Roczny przychód obecny [zł]": str(simulation.current_annual_revenue),
            "Roczny przychód po waloryzacji [zł]": str(simulation.proposed_annual_revenue),
            "Wzrost roczny [zł]": str(simulation.delta_annual_revenue),
            "Wzrost roczny [%]": str(simulation.delta_annual_revenue_pct),
        }

    def _build_template_context(
        self,
        *,
        generation_id: uuid.UUID | None,
        request: GenerationRequest,
        context: dict[str, Any],
        simulation: SimulationSummary,
        rationale_bullets: list[str],
        draft: bool,
        amendment_number: str,
        amendment_date: date,
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        manifest = self._registry.get_manifest(request.template_key)
        customer: Customer = context["customer"]
        ctx: dict[str, Any] = {
            "customer": customer,
            "company": customer.company,
            "contract": context["contract"],
            "params": request.params,
            "simulation": simulation,
            "rationale_bullets": rationale_bullets,
            "draft": draft,
            "amendment_number": amendment_number,
            "amendment_date": amendment_date,
            "generation_id": str(generation_id) if generation_id else "—",
            "template_key": request.template_key,
            "template_version": str(manifest["version"]),
            "generated_at": datetime.now(UTC),
            "account_manager_name": _account_manager_display(customer),
        }
        if extra:
            ctx.update(extra)
        return ctx

    @staticmethod
    def _next_amendment_number(contract: Contract) -> str:
        existing = list(contract.amendments) if contract.amendments else []
        return f"{len(existing) + 1}/{date.today().year}"

    @staticmethod
    def _safe_filename(text: str) -> str:
        """Strip path-unsafe chars so the value is safe in filenames + S3 keys."""
        return text.replace("/", "-").replace("\\", "-").replace(" ", "_")

    async def _upload_pdf(
        self,
        *,
        pdf: bytes,
        customer: Customer,
        contract: Contract,
        document_type: DocumentType,
        filename: str,
        uploaded_by: uuid.UUID,
    ) -> Any:
        company_id = customer.company_id
        # Filename can still contain `/` if caller forgot to sanitise it; do it here
        # defensively to keep S3 keys flat (no nested directories from filename).
        safe_filename = filename.replace("/", "-").replace("\\", "-")
        s3_key = (
            f"companies/{company_id or 'unassigned'}/generated/{uuid.uuid4()}_{safe_filename}"
        )
        try:
            await self._storage.upload_bytes(
                key=s3_key, content=pdf, content_type="application/pdf"
            )
        except StorageServiceError as exc:
            raise DocumentStorageError("Could not upload generated PDF") from exc

        return await self._attachment_repo.create(
            {
                "company_id": company_id,
                "customer_id": customer.id,
                "contract_id": contract.id,
                "document_type": document_type,
                "original_filename": filename,
                "s3_bucket": settings.s3_bucket,
                "s3_key": s3_key,
                "mime_type": "application/pdf",
                "file_size_bytes": len(pdf),
                "uploaded_by": uploaded_by,
            }
        )

    async def _replace_pdf(
        self, *, attachment_id: uuid.UUID | None, pdf: bytes, new_filename: str
    ) -> None:
        if attachment_id is None:
            return
        attachment = await self._attachment_repo.get(attachment_id)
        if attachment is None:
            return
        try:
            await self._storage.upload_bytes(
                key=attachment.s3_key, content=pdf, content_type="application/pdf"
            )
        except StorageServiceError as exc:
            raise DocumentStorageError("Could not replace generated PDF") from exc
        attachment.original_filename = new_filename
        attachment.file_size_bytes = len(pdf)


# ── Module helpers ───────────────────────────────────────────────────────────


def _serializable(payload: Any) -> Any:
    if isinstance(payload, dict):
        return {k: _serializable(v) for k, v in payload.items()}
    if isinstance(payload, list):
        return [_serializable(v) for v in payload]
    if isinstance(payload, Decimal):
        return str(payload)
    if isinstance(payload, (date, datetime)):
        return payload.isoformat()
    if isinstance(payload, uuid.UUID):
        return str(payload)
    return payload


def _hash_facts(facts: dict[str, Any], user_instructions: str | None) -> str:
    payload = "\n".join(f"{k}={v}" for k, v in sorted(facts.items()))
    if user_instructions:
        payload += "\n---\n" + user_instructions.strip()
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _account_manager_display(customer: Customer) -> str:
    am = customer.account_manager
    if am is None:
        return "Opiekun klienta"
    return am.email or am.login or "Opiekun klienta"
