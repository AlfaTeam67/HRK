from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class CRUDService:
    def __init__(self, db_url: str) -> None:
        self.engine = create_engine(db_url)

    def create(self, table_name: str, data: dict[str, Any]) -> dict[str, Any]:
        self._validate_identifier(table_name, "table_name")
        self._validate_table_exists(table_name)

        columns = self._get_table_columns(table_name)
        filtered_data = {k: v for k, v in data.items() if k in columns}

        if not filtered_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid columns provided for insertion"
            )

        columns_list = ", ".join(filtered_data.keys())
        placeholders = ", ".join([f":{k}" for k in filtered_data])
        sql = text(f"INSERT INTO {table_name} ({columns_list}) VALUES ({placeholders}) RETURNING *")

        try:
            with self.engine.connect() as conn:
                result = conn.execute(sql, filtered_data)
                conn.commit()
                row = result.fetchone()
                if row:
                    return dict(row._mapping)
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error creating record: {str(exc)}"
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create record"
        )

    def get_multi(self, table_name: str, skip: int = 0, limit: int = 100) -> dict[str, Any]:
        self._validate_identifier(table_name, "table_name")
        self._validate_table_exists(table_name)

        sql = text(f"SELECT * FROM {table_name} OFFSET :skip LIMIT :limit")

        try:
            with self.engine.connect() as conn:
                result = conn.execute(sql, {"skip": skip, "limit": limit})
                rows = result.fetchall()
                return {
                    "items": [dict(row._mapping) for row in rows],
                    "count": len(rows),
                    "skip": skip,
                    "limit": limit
                }
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error fetching records: {str(exc)}"
            ) from exc

    def get(self, table_name: str, record_id: int) -> dict[str, Any]:
        self._validate_identifier(table_name, "table_name")
        self._validate_table_exists(table_name)

        sql = text(f"SELECT * FROM {table_name} WHERE id = :id")

        try:
            with self.engine.connect() as conn:
                result = conn.execute(sql, {"id": record_id})
                row = result.fetchone()
                if row:
                    return dict(row._mapping)
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error fetching record: {str(exc)}"
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Record with id {record_id} not found in table {table_name}"
        )

    def update(self, table_name: str, record_id: int, data: dict[str, Any]) -> dict[str, Any]:
        self._validate_identifier(table_name, "table_name")
        self._validate_table_exists(table_name)

        columns = self._get_table_columns(table_name)
        filtered_data = {k: v for k, v in data.items() if k in columns and k != "id"}

        if not filtered_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid columns provided for update"
            )

        set_clause = ", ".join([f"{k} = :{k}" for k in filtered_data])
        sql = text(f"UPDATE {table_name} SET {set_clause} WHERE id = :id RETURNING *")
        filtered_data["id"] = record_id

        try:
            with self.engine.connect() as conn:
                result = conn.execute(sql, filtered_data)
                conn.commit()
                row = result.fetchone()
                if row:
                    return dict(row._mapping)
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error updating record: {str(exc)}"
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Record with id {record_id} not found in table {table_name}"
        )

    def delete(self, table_name: str, record_id: int) -> dict[str, str]:
        self._validate_identifier(table_name, "table_name")
        self._validate_table_exists(table_name)

        sql = text(f"DELETE FROM {table_name} WHERE id = :id")

        try:
            with self.engine.connect() as conn:
                result = conn.execute(sql, {"id": record_id})
                conn.commit()
                if result.rowcount > 0:
                    return {"status": "success", "message": f"Record {record_id} deleted from {table_name}"}
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error deleting record: {str(exc)}"
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Record with id {record_id} not found in table {table_name}"
        )

    def _validate_identifier(self, value: str, field_name: str) -> None:
        if not _IDENTIFIER_RE.fullmatch(value):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid {field_name}. Use letters, numbers and underscores only."
            )

    def _validate_table_exists(self, table_name: str) -> None:
        sql = text(
            """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = :table_name
            )
            """
        )
        try:
            with self.engine.connect() as conn:
                result = conn.execute(sql, {"table_name": table_name}).scalar()
                if not result:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Table {table_name} does not exist"
                    )
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error checking table existence: {str(exc)}"
            ) from exc

    def _get_table_columns(self, table_name: str) -> set[str]:
        sql = text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = :table_name
            """
        )
        try:
            with self.engine.connect() as conn:
                result = conn.execute(sql, {"table_name": table_name}).fetchall()
                return {row[0] for row in result}
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error fetching table columns: {str(exc)}"
            ) from exc
