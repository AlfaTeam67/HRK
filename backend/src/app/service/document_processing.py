"""Document processing: text extraction, chunking, embedding, and DB storage."""

from __future__ import annotations

import io
import logging
from uuid import UUID

import pdfplumber
import pytesseract  # type: ignore[import-untyped]
from pdf2image import convert_from_bytes
from PIL import Image

from app.core.database import AsyncSessionLocal
from app.models.enums import OcrStatus
from app.repo.attachment import AttachmentRepository
from app.repo.document_chunk import DocumentChunkRepository
from app.service.embedding import EmbeddingService

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1600  # chars ≈ 400 tokens
CHUNK_OVERLAP = 320  # chars ≈ 80 tokens

_PDF_MIME = "application/pdf"
_TEXT_MIME = "text/plain"
_IMAGE_MIMES = {"image/jpeg", "image/png", "image/tiff", "image/bmp", "image/webp"}
_PROCESSABLE = {_PDF_MIME, _TEXT_MIME} | _IMAGE_MIMES


def _split_long(text: str, page: int | None) -> list[tuple[str, int | None]]:
    if len(text) <= CHUNK_SIZE:
        return [(text, page)]
    parts: list[tuple[str, int | None]] = []
    start = 0
    while start < len(text):
        parts.append((text[start : start + CHUNK_SIZE], page))
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return parts


def _extract_from_pdf(content: bytes) -> list[tuple[str, int | None]]:
    raw: list[tuple[str, int | None]] = []
    
    # We'll use a hybrid approach: try pdfplumber first, if a page is empty, try OCR
    # To do OCR efficiently, we convert to images once if needed
    images: list[Image.Image] | None = None
    
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            page_text = page.extract_text() or ""
            page_paras = [p.strip() for p in page_text.split("\n\n") if p.strip()]
            
            if not page_paras:
                # Page is empty or image-based, try OCR for THIS page
                if images is None:
                    images = convert_from_bytes(content, dpi=200)
                
                # Check if we have an image for this page (enumerate starts at 1)
                if len(images) >= page_num:
                    ocr_text = pytesseract.image_to_string(images[page_num - 1], lang="pol+eng")
                    page_paras = [p.strip() for p in ocr_text.split("\n\n") if p.strip()]
            
            for para in page_paras:
                raw.append((para, page_num))
                
    return raw


def _extract_paragraphs(content: bytes, mime_type: str) -> list[tuple[str, int | None]]:
    raw: list[tuple[str, int | None]] = []

    if mime_type == _PDF_MIME:
        raw = _extract_from_pdf(content)
    elif mime_type == _TEXT_MIME:
        text = content.decode("utf-8", errors="replace")
        for para in text.split("\n\n"):
            para = para.strip()
            if para:
                raw.append((para, None))
    elif mime_type in _IMAGE_MIMES:
        image = Image.open(io.BytesIO(content))
        text = pytesseract.image_to_string(image, lang="pol+eng")
        for para in text.split("\n\n"):
            para = para.strip()
            if para:
                raw.append((para, 1))

    result: list[tuple[str, int | None]] = []
    for para, page in raw:
        result.extend(_split_long(para, page))
    return result


def _build_chunks(paragraphs: list[tuple[str, int | None]]) -> list[dict]:
    if not paragraphs:
        return []

    chunks: list[dict] = []
    current_parts: list[str] = []
    current_size = 0
    current_page: int | None = paragraphs[0][1]

    for para, page in paragraphs:
        addition = len(para) + (2 if current_parts else 0)
        # Force split if page changes OR size limit exceeded
        page_changed = page != current_page
        
        if not page_changed and current_size + addition <= CHUNK_SIZE:
            current_parts.append(para)
            current_size += addition
        else:
            if current_parts:
                chunks.append({"content": "\n\n".join(current_parts), "page_number": current_page})
                
                if page_changed:
                    # Don't carry over overlap if page changed
                    current_parts = [para]
                    current_size = len(para)
                else:
                    # Standard overlap logic for same page
                    overlap: list[str] = []
                    overlap_size = 0
                    for part in reversed(current_parts):
                        cost = len(part) + (2 if overlap else 0)
                        if overlap_size + cost <= CHUNK_OVERLAP:
                            overlap.insert(0, part)
                            overlap_size += cost
                        else:
                            break
                    current_parts = overlap + [para]
                    current_size = overlap_size + len(para)
                
                current_page = page
            else:
                current_parts = [para]
                current_size = len(para)
                current_page = page

    if current_parts:
        chunks.append({"content": "\n\n".join(current_parts), "page_number": current_page})

    return chunks


class DocumentProcessingService:
    def __init__(self) -> None:
        self._embed = EmbeddingService()

    async def process(
        self,
        attachment_id: UUID,
        customer_id: UUID | None,
        content: bytes,
        mime_type: str,
    ) -> None:
        async with AsyncSessionLocal() as session:
            attachments = AttachmentRepository(session)
            chunks_repo = DocumentChunkRepository(session)

            attachment = await attachments.get(attachment_id)
            if attachment is None:
                logger.error(
                    "Attachment not found for processing", extra={"id": str(attachment_id)}
                )
                return

            if mime_type not in _PROCESSABLE:
                attachment.ocr_status = OcrStatus.SKIPPED
                await session.commit()
                return

            attachment.ocr_status = OcrStatus.PROCESSING
            await session.commit()

            try:
                paragraphs = _extract_paragraphs(content, mime_type)
                raw_chunks = _build_chunks(paragraphs)

                if not raw_chunks:
                    attachment.ocr_status = OcrStatus.SKIPPED
                    await session.commit()
                    return

                chunk_rows = []
                for i, chunk in enumerate(raw_chunks):
                    embedding = await self._embed.embed(chunk["content"])
                    chunk_rows.append(
                        {
                            "attachment_id": attachment_id,
                            "customer_id": customer_id,
                            "chunk_index": i,
                            "content": chunk["content"],
                            "token_count": len(chunk["content"].split()),
                            "page_number": chunk["page_number"],
                            "bbox": None,
                            "section_title": None,
                            "embedding": embedding,
                        }
                    )

                await chunks_repo.bulk_insert(chunk_rows)
                attachment.ocr_status = OcrStatus.DONE
                await session.commit()
                logger.info(
                    "Document processed",
                    extra={"id": str(attachment_id), "chunks": len(chunk_rows)},
                )
            except Exception:
                logger.exception("Document processing failed", extra={"id": str(attachment_id)})
                try:
                    attachment.ocr_status = OcrStatus.FAILED
                    await session.commit()
                except Exception:
                    logger.exception("Could not update ocr_status to failed")
