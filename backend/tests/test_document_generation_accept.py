"""Unit tests for DocumentGenerationService.accept — new attachment flow."""

from __future__ import annotations

import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import BackgroundTasks

from app.models.enums import DocumentGenerationStatus, DocumentType, OcrStatus
from app.service.document_generation.service import DocumentGenerationService


def _make_attachment(*, ocr_status: OcrStatus = OcrStatus.SKIPPED) -> MagicMock:
    att = MagicMock()
    att.id = uuid.uuid4()
    att.s3_key = f"companies/test/{uuid.uuid4()}_DRAFT.pdf"
    att.ocr_status = ocr_status
    return att


def _make_generation(
    *,
    status: DocumentGenerationStatus = DocumentGenerationStatus.PREVIEW,
    has_cover: bool = False,
) -> MagicMock:
    gen = MagicMock()
    gen.id = uuid.uuid4()
    gen.customer_id = uuid.uuid4()
    gen.contract_id = uuid.uuid4()
    gen.status = status
    gen.attachment_pdf_id = uuid.uuid4()
    gen.cover_letter_attachment_id = uuid.uuid4() if has_cover else None
    gen.payload = {
        "request": {
            "template_key": "valorization_v1",
            "customer_id": str(gen.customer_id),
            "contract_id": str(gen.contract_id),
            "params": {
                "year": 2025,
                "index_type": "GUS_CPI",
                "index_value": "5.0",
                "effective_date": "2025-01-01",
            },
            "include_ai_rationale": False,
            "include_cover_letter": has_cover,
            "tone": "formal",
            "user_instructions": None,
        },
        "amendment_number": "1/2025",
        "amendment_date": date.today().isoformat(),
    }
    gen.ai_artifacts = {
        "rationale_bullets": [],
        "cover_letter_text": "Cover letter content." if has_cover else None,
    }
    return gen


@pytest.fixture
def service() -> DocumentGenerationService:
    session = AsyncMock()
    svc = DocumentGenerationService(session)

    # Stub out heavy dependencies
    svc._gen_repo = AsyncMock()
    svc._attachment_repo = AsyncMock()
    svc._activity_repo = AsyncMock()
    svc._storage = AsyncMock()
    svc._renderer = AsyncMock()
    svc._llm = AsyncMock()
    svc._ctx_repo = AsyncMock()
    svc._contract_repo = AsyncMock()
    svc._registry = MagicMock()

    return svc


def _wire_service_for_accept(
    service: DocumentGenerationService,
    gen: MagicMock,
    *,
    has_cover: bool = False,
) -> tuple[MagicMock, MagicMock | None]:
    """Configure service mocks for a full accept() run."""
    old_amendment_att = _make_attachment()
    old_cover_att = _make_attachment() if has_cover else None

    service._gen_repo.get = AsyncMock(return_value=gen)
    service._gen_repo.update = AsyncMock(return_value=gen)

    def get_attachment(att_id):
        if att_id == gen.attachment_pdf_id:
            return old_amendment_att
        if has_cover and att_id == gen.cover_letter_attachment_id:
            return old_cover_att
        return None

    service._attachment_repo.get = AsyncMock(side_effect=get_attachment)
    service._attachment_repo.delete = AsyncMock(return_value=True)

    # Context / simulation
    customer = MagicMock()
    customer.id = gen.customer_id
    customer.company_id = uuid.uuid4()
    customer.company = MagicMock()
    customer.company.name = "Test Company"
    customer.account_manager = None

    contract = MagicMock()
    contract.id = gen.contract_id
    contract.customer_id = gen.customer_id
    contract.contract_number = "UMW-001"
    contract.amendments = []
    contract.contract_services = []
    contract.start_date = date(2020, 1, 1)

    service._ctx_repo.get_customer_with_company = AsyncMock(return_value=customer)
    service._ctx_repo.get_contract_with_services = AsyncMock(return_value=contract)
    service._ctx_repo.get_rates_for_services = AsyncMock(return_value={})
    service._ctx_repo.get_service_names = AsyncMock(return_value={})

    service._registry.get_manifest = MagicMock(return_value={"version": "1.0"})
    service._registry.render_main = MagicMock(return_value="<html>clean</html>")
    service._registry.render_cover_letter = MagicMock(return_value="<html>cover</html>")

    service._renderer.render = AsyncMock(return_value=b"%PDF-clean")

    new_amendment_att = _make_attachment(ocr_status=OcrStatus.PENDING)
    new_cover_att = _make_attachment(ocr_status=OcrStatus.PENDING) if has_cover else None

    create_calls = [new_amendment_att]
    if has_cover:
        create_calls.append(new_cover_att)
    service._attachment_repo.create = AsyncMock(side_effect=create_calls)

    return old_amendment_att, old_cover_att


@pytest.mark.asyncio
async def test_accept_creates_new_attachments(service: DocumentGenerationService) -> None:
    gen = _make_generation()
    _wire_service_for_accept(service, gen)
    accepted_by = uuid.uuid4()

    with patch("app.service.document_generation.service.DocumentProcessingService"):
        await service.accept(gen.id, accepted_by=accepted_by, background_tasks=BackgroundTasks())

    # Two creates: one for amendment (create is called once; cover letter absent)
    service._attachment_repo.create.assert_called_once()
    _, kwargs = service._attachment_repo.create.call_args
    created = service._attachment_repo.create.call_args[0][0]
    assert created["ocr_status"] == OcrStatus.PENDING
    assert "_DRAFT" not in created["original_filename"]
    assert created["document_type"] == DocumentType.AMENDMENT
    assert created["uploaded_by"] == accepted_by


@pytest.mark.asyncio
async def test_accept_updates_generation_with_new_attachment_id(
    service: DocumentGenerationService,
) -> None:
    gen = _make_generation()
    _wire_service_for_accept(service, gen)
    old_pdf_id = gen.attachment_pdf_id

    with patch("app.service.document_generation.service.DocumentProcessingService"):
        await service.accept(gen.id, accepted_by=uuid.uuid4(), background_tasks=BackgroundTasks())

    update_kwargs = service._gen_repo.update.call_args[0][1]
    assert update_kwargs["status"] == DocumentGenerationStatus.ACCEPTED
    assert update_kwargs["attachment_pdf_id"] != old_pdf_id


@pytest.mark.asyncio
async def test_accept_deletes_draft_from_s3_and_db(service: DocumentGenerationService) -> None:
    gen = _make_generation()
    old_amendment_att, _ = _wire_service_for_accept(service, gen)

    with patch("app.service.document_generation.service.DocumentProcessingService"):
        await service.accept(gen.id, accepted_by=uuid.uuid4(), background_tasks=BackgroundTasks())

    service._storage.delete_object.assert_called_once_with(key=old_amendment_att.s3_key)
    service._attachment_repo.delete.assert_called_once_with(old_amendment_att.id, soft=False)



@pytest.mark.asyncio
async def test_accept_rejects_non_preview_status(service: DocumentGenerationService) -> None:
    gen = _make_generation(status=DocumentGenerationStatus.ACCEPTED)
    service._gen_repo.get = AsyncMock(return_value=gen)

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await service.accept(gen.id, accepted_by=uuid.uuid4(), background_tasks=BackgroundTasks())

    assert exc_info.value.status_code == 409
