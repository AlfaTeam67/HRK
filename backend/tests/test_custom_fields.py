"""Tests for custom fields service."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.custom_data import CustomFieldDefinitionCreate
from app.service.custom_data import CustomDataService


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def service(mock_db):
    return CustomDataService(mock_db, schema_manager_url="http://test:8002")


@pytest.mark.asyncio
async def test_create_field_definition_validates_type(service):
    """Reject invalid field types."""
    payload = CustomFieldDefinitionCreate(
        field_name="test_field", field_type="INVALID", display_name="Test"
    )
    with pytest.raises(Exception) as exc_info:
        await service.create_field_definition(uuid.uuid4(), payload)
    assert "Unsupported field_type" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_create_field_definition_enforces_limit(service):
    """Max 20 fields per customer."""
    with patch.object(service.field_repo, "count_for_customer", return_value=20):
        payload = CustomFieldDefinitionCreate(
            field_name="test_field", field_type="TEXT", display_name="Test"
        )
        with pytest.raises(Exception) as exc_info:
            await service.create_field_definition(uuid.uuid4(), payload)
        assert "Maximum" in str(exc_info.value.detail)
