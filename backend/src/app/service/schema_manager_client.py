"""Async HTTP client for Schema Manager microservice."""

from typing import Any

import httpx
from fastapi import HTTPException, status


class SchemaManagerClient:
    """Communicates with the Schema Manager microservice over HTTP."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    async def create_table(self, table_name: str) -> None:
        await self._post("/tables/create", {"table_name": table_name})

    async def drop_table(self, table_name: str) -> None:
        await self._delete("/tables/drop", {"table_name": table_name})

    async def add_column(self, table_name: str, column_name: str, column_type: str) -> None:
        await self._post(
            "/columns/add",
            {"table_name": table_name, "column_name": column_name, "column_type": column_type},
        )

    async def drop_column(self, table_name: str, column_name: str) -> None:
        await self._delete("/columns/drop", {"table_name": table_name, "column_name": column_name})

    async def insert_row(self, table_name: str, data: dict[str, Any]) -> dict[str, Any]:
        return await self._post(f"/crud/{table_name}", {"data": data})

    async def get_rows(self, table_name: str, skip: int = 0, limit: int = 100) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/crud/{table_name}", params={"skip": skip, "limit": limit}
            )
            self._check_response(resp)
            result: dict[str, Any] = resp.json()
            return result

    async def update_row(
        self, table_name: str, row_id: int, data: dict[str, Any]
    ) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{self.base_url}/crud/{table_name}/{row_id}", json={"data": data}
            )
            self._check_response(resp)
            result: dict[str, Any] = resp.json()
            return result

    async def delete_row(self, table_name: str, row_id: int) -> None:
        async with httpx.AsyncClient() as client:
            resp = await client.delete(f"{self.base_url}/crud/{table_name}/{row_id}")
            self._check_response(resp)

    async def _post(self, path: str, json_data: dict) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.base_url}{path}", json=json_data)
            self._check_response(resp)
            result: dict[str, Any] = resp.json()
            return result

    async def _delete(self, path: str, json_data: dict) -> None:
        async with httpx.AsyncClient() as client:
            resp = await client.request("DELETE", f"{self.base_url}{path}", json=json_data)
            self._check_response(resp)

    def _check_response(self, resp: httpx.Response) -> None:
        if resp.status_code >= 400:
            try:
                detail = resp.json().get("detail", "Schema Manager error")
            except Exception:
                detail = "Schema Manager error"
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Schema Manager: {detail}",
            )
