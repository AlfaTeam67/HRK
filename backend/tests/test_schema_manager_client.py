"""Tests for Schema Manager HTTP client."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.service.schema_manager_client import SchemaManagerClient


@pytest.fixture
def client():
    return SchemaManagerClient(base_url="http://test:8002")


def _mock_response(status_code: int = 200, json_data: dict | None = None):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
    return resp


def _patch_async_client(method: str, response):
    """Patch httpx.AsyncClient as async context manager."""
    mock_client = AsyncMock()
    getattr(mock_client, method).return_value = response
    mock_client.request = AsyncMock(return_value=response)
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=mock_client)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return patch("httpx.AsyncClient", return_value=ctx), mock_client


@pytest.mark.asyncio
async def test_create_table_calls_correct_endpoint(client):
    resp = _mock_response(200, {"status": "success"})
    patcher, mock_cl = _patch_async_client("post", resp)
    with patcher:
        await client.create_table("ct_abc123_test")
    mock_cl.post.assert_called_once_with(
        "http://test:8002/tables/create", json={"table_name": "ct_abc123_test"}
    )


@pytest.mark.asyncio
async def test_add_column_calls_correct_endpoint(client):
    resp = _mock_response(200, {"status": "success"})
    patcher, mock_cl = _patch_async_client("post", resp)
    with patcher:
        await client.add_column("ct_abc123_test", "name", "TEXT")
    mock_cl.post.assert_called_once_with(
        "http://test:8002/columns/add",
        json={"table_name": "ct_abc123_test", "column_name": "name", "column_type": "TEXT"},
    )


@pytest.mark.asyncio
async def test_insert_row_calls_correct_endpoint(client):
    resp = _mock_response(200, {"id": 1, "name": "Jan"})
    patcher, mock_cl = _patch_async_client("post", resp)
    with patcher:
        result = await client.insert_row("ct_abc123_test", {"name": "Jan"})
    mock_cl.post.assert_called_once_with(
        "http://test:8002/crud/ct_abc123_test", json={"data": {"name": "Jan"}}
    )
    assert result == {"id": 1, "name": "Jan"}


@pytest.mark.asyncio
async def test_create_table_raises_on_error(client):
    resp = _mock_response(400, {"detail": "Invalid table_name"})
    patcher, _ = _patch_async_client("post", resp)
    with patcher:
        with pytest.raises(HTTPException) as exc_info:
            await client.create_table("invalid!")
    assert exc_info.value.status_code == 502
    assert "Schema Manager" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_rows_calls_correct_endpoint(client):
    resp = _mock_response(200, {"items": [{"id": 1}], "count": 1})
    patcher, mock_cl = _patch_async_client("get", resp)
    with patcher:
        result = await client.get_rows("ct_abc123_test", skip=0, limit=50)
    mock_cl.get.assert_called_once_with(
        "http://test:8002/crud/ct_abc123_test", params={"skip": 0, "limit": 50}
    )
    assert result == {"items": [{"id": 1}], "count": 1}
