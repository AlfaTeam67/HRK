from fastapi import FastAPI

from controllers.schema_manager_controller import router as schema_manager_router
from controllers.crud_controller import router as crud_router

app = FastAPI(title="HRK Schema Manager")
app.include_router(schema_manager_router)
app.include_router(crud_router)
