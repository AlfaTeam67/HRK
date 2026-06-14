"""Integration tests for custom tables flow."""

import uuid
from unittest.mock import AsyncMock

import pytest

from app.service.custom_data import CustomDataService


@pytest.mark.asyncio
async def test_generate_table_name():
    """Table name follows ct_{8chars}_{slug} format."""
    service = CustomDataService(db=AsyncMock(), schema_manager_url="http://test:8002")
    customer_id = uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    result = service._generate_table_name(customer_id, "pracownicy")
    assert result == "ct_a1b2c3d4_pracownicy"


@pytest.mark.asyncio
async def test_validate_field_type_rejects_invalid():
    """Only allowed types pass validation."""
    service = CustomDataService(db=AsyncMock(), schema_manager_url="http://test:8002")
    with pytest.raises(Exception) as exc_info:
        service._validate_field_type("INVALID")
    assert "Unsupported" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_validate_field_type_accepts_valid():
    """All allowed types pass."""
    service = CustomDataService(db=AsyncMock(), schema_manager_url="http://test:8002")
    for t in ("TEXT", "INTEGER", "BOOLEAN", "DATE", "FLOAT"):
        service._validate_field_type(t)  # Should not raise
