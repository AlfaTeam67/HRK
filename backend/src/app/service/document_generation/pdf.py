"""HTML → PDF rendering via WeasyPrint."""

from __future__ import annotations

import asyncio
import hashlib
from typing import Any

from weasyprint import HTML


class PdfRenderer:
    """Stateless renderer — wraps WeasyPrint behind an async interface.

    WeasyPrint is sync, so we offload to the default executor to avoid
    blocking the event loop on larger documents.
    """

    async def render(self, html: str, *, base_url: str | None = None) -> bytes:
        return await asyncio.to_thread(self._render_sync, html, base_url)

    @staticmethod
    def _render_sync(html: str, base_url: str | None) -> bytes:
        result: Any = HTML(string=html, base_url=base_url).write_pdf()
        if not isinstance(result, bytes):
            raise RuntimeError("WeasyPrint returned non-bytes payload")
        return result

    @staticmethod
    def sha256(payload: bytes) -> str:
        return hashlib.sha256(payload).hexdigest()
