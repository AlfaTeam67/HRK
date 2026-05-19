"""Jinja2 template registry — loads documents/* manifests and renders HTML.

Templates and their ``manifest.yml`` are part of the codebase, not the DB.
Each template carries a semver — every persisted generation pins the version
so that historical PDFs can be reproduced byte-for-byte.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from app.schemas.document_generation import DocumentTemplateRead

_TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates" / "documents"


# ── Polish formatting filters ────────────────────────────────────────────────


_POLISH_MONTHS = (
    "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
    "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
)


def _format_pl_date(value: date | datetime | None) -> str:
    if value is None:
        return "—"
    return f"{value.day} {_POLISH_MONTHS[value.month - 1]} {value.year}"


def _format_pl_datetime(value: datetime | None) -> str:
    if value is None:
        return "—"
    return f"{_format_pl_date(value)}, {value:%H:%M}"


def _format_pl_money(value: Decimal | float | int | None) -> str:
    if value is None:
        return "—"
    amount = Decimal(value).quantize(Decimal("0.01"))
    sign = "-" if amount < 0 else ""
    abs_amount = abs(amount)
    integer_part, _, frac_part = f"{abs_amount:.2f}".partition(".")
    grouped = " ".join(
        integer_part[max(i - 3, 0):i] for i in range(len(integer_part), 0, -3)
    )
    grouped = " ".join(reversed(grouped.split()))
    return f"{sign}{grouped},{frac_part} zł"


def _format_pl_money_signed(value: Decimal | float | int | None) -> str:
    if value is None:
        return "—"
    amount = Decimal(value)
    if amount > 0:
        return "+" + _format_pl_money(amount)
    return _format_pl_money(amount)


def _format_pl_pct(value: Decimal | float | int | None) -> str:
    if value is None:
        return "—"
    amount = Decimal(value).quantize(Decimal("0.01"))
    integer_part, _, frac_part = f"{abs(amount):.2f}".partition(".")
    sign = "-" if amount < 0 else ""
    return f"{sign}{integer_part},{frac_part}%"


# ── Registry ─────────────────────────────────────────────────────────────────


class TemplateNotFoundError(Exception):
    """Raised when caller asks for a template key that is not registered."""


class TemplateRegistry:
    """Loads manifests from disk and renders Jinja2 templates."""

    def __init__(self, base_dir: Path | None = None) -> None:
        self._base_dir = base_dir or _TEMPLATES_DIR
        self._env = Environment(
            loader=FileSystemLoader(str(self._base_dir)),
            autoescape=select_autoescape(enabled_extensions=("html", "j2")),
            undefined=StrictUndefined,
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self._env.filters["pl_date"] = _format_pl_date
        self._env.filters["pl_datetime"] = _format_pl_datetime
        self._env.filters["pl_money"] = _format_pl_money
        self._env.filters["pl_money_signed"] = _format_pl_money_signed
        self._env.filters["pl_pct"] = _format_pl_pct

    @lru_cache(maxsize=32)  # noqa: B019  — instance-level cache acceptable here
    def list_templates(self) -> tuple[DocumentTemplateRead, ...]:
        items: list[DocumentTemplateRead] = []
        for manifest_path in sorted(self._base_dir.glob("*/manifest.yml")):
            manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
            items.append(
                DocumentTemplateRead(
                    key=manifest["key"],
                    version=str(manifest["version"]),
                    title=manifest["title"],
                    description=manifest["description"].strip(),
                    output_document_type=manifest["output_document_type"],
                    creates_amendment=bool(manifest.get("creates_amendment", False)),
                    params_schema=manifest["params_schema"],
                )
            )
        return tuple(items)

    def get_manifest(self, template_key: str) -> dict[str, Any]:
        manifest_path = self._base_dir / template_key / "manifest.yml"
        if not manifest_path.exists():
            raise TemplateNotFoundError(f"Template '{template_key}' not found")
        return yaml.safe_load(manifest_path.read_text(encoding="utf-8"))

    def render_main(self, template_key: str, context: dict[str, Any]) -> str:
        manifest = self.get_manifest(template_key)
        template_path = f"{template_key}/{manifest['template_file']}"
        return self._env.get_template(template_path).render(**context)

    def render_cover_letter(self, template_key: str, context: dict[str, Any]) -> str:
        manifest = self.get_manifest(template_key)
        rel = manifest.get("cover_letter_template_file")
        if not rel:
            raise TemplateNotFoundError(
                f"Template '{template_key}' has no cover_letter_template_file"
            )
        # Resolve relative path against the template's own directory, then make
        # it relative to the loader root so Jinja can find it.
        absolute = (self._base_dir / template_key / rel).resolve()
        try:
            template_path = absolute.relative_to(self._base_dir.resolve())
        except ValueError as exc:
            raise TemplateNotFoundError(
                f"Cover letter template '{rel}' resolves outside template root"
            ) from exc
        return self._env.get_template(str(template_path)).render(**context)


# Singleton — templates are read-only at runtime, no need for per-request instances.
_registry: TemplateRegistry | None = None


def get_template_registry() -> TemplateRegistry:
    global _registry
    if _registry is None:
        _registry = TemplateRegistry()
    return _registry
