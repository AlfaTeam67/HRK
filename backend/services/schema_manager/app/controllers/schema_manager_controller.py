import os

from fastapi import APIRouter

from app.models import (
    ColumnAdd,
    ColumnDrop,
    ColumnTypeUpdate,
    TableCreate,
    TableDrop,
    TableRename,
)
from app.service import SchemaManagerService

router = APIRouter()
service = SchemaManagerService(
    os.getenv("DATABASE_URL", "postgresql://hrk:hrk_secret@db:5432/hrk_db")
)


@router.post("/tables/create")
def create_new_table(data: TableCreate):
    return service.create_table(data.table_name)


@router.delete("/tables/drop")
def drop_table(data: TableDrop):
    return service.drop_table(data.table_name)


@router.put("/tables/rename")
def rename_table(data: TableRename):
    return service.rename_table(data.table_name, data.new_table_name)


@router.post("/columns/add")
def add_column(data: ColumnAdd):
    return service.add_column(data.table_name, data.column_name, data.column_type)


@router.delete("/columns/drop")
def drop_column(data: ColumnDrop):
    return service.drop_column(data.table_name, data.column_name)


@router.put("/columns/update-type")
def update_column_type(data: ColumnTypeUpdate):
    return service.update_column_type(data.table_name, data.column_name, data.column_type)


@router.get("/tables/inspect/{table_name}")
def get_table_schema(table_name: str):
    return service.inspect_table(table_name)
