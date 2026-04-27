from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError


_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_ALLOWED_COLUMN_TYPES = {
    "TEXT": "TEXT",
    "INTEGER": "INTEGER",
    "INT": "INTEGER",
    "BOOLEAN": "BOOLEAN",
    "TIMESTAMP": "TIMESTAMP",
    "DATE": "DATE",
    "FLOAT": "DOUBLE PRECISION",
    "DOUBLE": "DOUBLE PRECISION",
    "NUMERIC": "NUMERIC",
    "VARCHAR": "VARCHAR(255)",
}


@dataclass
class SchemaManagerService:
    db_url: str
    engine: Any = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self.engine = create_engine(self.db_url)

    def create_table(self, table_name: str) -> dict[str, str]:
        self._validate_identifier(table_name, "table_name")
        sql = text(f"CREATE TABLE IF NOT EXISTS {table_name} (id SERIAL PRIMARY KEY)")
        self._execute(sql)
        return {"status": "success", "message": f"Tabela {table_name} stworzona"}

    def drop_table(self, table_name: str) -> dict[str, str]:
        self._validate_identifier(table_name, "table_name")
        sql = text(f"DROP TABLE IF EXISTS {table_name} CASCADE")
        self._execute(sql)
        return {"status": "success", "message": f"Tabela {table_name} usunięta"}

    def rename_table(self, table_name: str, new_table_name: str) -> dict[str, str]:
        self._validate_identifier(table_name, "table_name")
        self._validate_identifier(new_table_name, "new_table_name")
        sql = text(f"ALTER TABLE {table_name} RENAME TO {new_table_name}")
        self._execute(sql)
        return {
            "status": "success",
            "message": f"Tabela {table_name} zmieniona na {new_table_name}",
        }

    def add_column(self, table_name: str, column_name: str, column_type: str) -> dict[str, str]:
        self._validate_identifier(table_name, "table_name")
        self._validate_identifier(column_name, "column_name")
        normalized_type = self._normalize_column_type(column_type)
        sql = text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {normalized_type}")
        self._execute(sql)
        return {"status": "success", "message": f"Dodano kolumnę {column_name}"}

    def drop_column(self, table_name: str, column_name: str) -> dict[str, str]:
        self._validate_identifier(table_name, "table_name")
        self._validate_identifier(column_name, "column_name")
        sql = text(f"ALTER TABLE {table_name} DROP COLUMN IF EXISTS {column_name}")
        self._execute(sql)
        return {"status": "success", "message": f"Usunięto kolumnę {column_name}"}

    def update_column_type(
        self, table_name: str, column_name: str, column_type: str
    ) -> dict[str, str]:
        self._validate_identifier(table_name, "table_name")
        self._validate_identifier(column_name, "column_name")
        normalized_type = self._normalize_column_type(column_type)
        sql = text(
            f"ALTER TABLE {table_name} ALTER COLUMN {column_name} TYPE {normalized_type}"
        )
        self._execute(sql)
        return {
            "status": "success",
            "message": f"Zmieniono typ kolumny {column_name} na {normalized_type}",
        }

    def inspect_table(self, table_name: str) -> dict[str, object]:
        self._validate_identifier(table_name, "table_name")
        sql = text(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = :table
            ORDER BY ordinal_position
            """
        )
        try:
            with self.engine.connect() as conn:
                result = conn.execute(sql, {"table": table_name}).fetchall()
        except SQLAlchemyError as exc:
            raise self._http_error(str(exc)) from exc
        return {"table": table_name, "columns": {row[0]: row[1] for row in result}}

    def _execute(self, sql) -> None:
        try:
            with self.engine.connect() as conn:
                conn.execute(sql)
                conn.commit()
        except SQLAlchemyError as exc:
            raise self._http_error(str(exc)) from exc

    def _validate_identifier(self, value: str, field_name: str) -> None:
        if not _IDENTIFIER_RE.fullmatch(value):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid {field_name}. Use letters, numbers and underscores only.",
            )

    def _normalize_column_type(self, column_type: str) -> str:
        normalized = column_type.strip().upper()
        if normalized not in _ALLOWED_COLUMN_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported column_type '{column_type}'.",
            )
        return _ALLOWED_COLUMN_TYPES[normalized]

    def _http_error(self, message: str) -> HTTPException:
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
