from pydantic import BaseModel


class TableCreate(BaseModel):
    table_name: str


class TableDrop(BaseModel):
    table_name: str


class ColumnAdd(BaseModel):
    table_name: str
    column_name: str
    column_type: str


class ColumnDrop(BaseModel):
    table_name: str
    column_name: str


class TableRename(BaseModel):
    table_name: str
    new_table_name: str


class ColumnTypeUpdate(BaseModel):
    table_name: str
    column_name: str
    column_type: str
