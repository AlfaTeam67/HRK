"""Application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI

from app.api.v1 import api_router as v1_router
from app.api import api_router as crm_router
from app.config import settings


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[Any, Any]:
    """Manage application lifespan."""
    print(f"Starting up {settings.app_name}...")
    yield
    print(f"Shutting down {settings.app_name}...")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    openapi_url=f"{settings.api_v1_str}/openapi.json" if settings.debug else None,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)

app.include_router(v1_router, prefix=settings.api_v1_str)
app.include_router(crm_router, prefix=settings.api_v1_str)


@app.get("/", tags=["status"])
async def root() -> Any:
    """Root endpoint."""
    return {
        "message": f"Welcome to {settings.app_name}",
        "version": settings.app_version,
    }


@app.get("/health", tags=["status"])
async def health_check() -> Any:
    """Health check endpoint."""
    return {
        "status": "ok",
        "environment": "development" if settings.debug else "production",
    }


if __name__ == "__main__":
    uvicorn.run(app, host=settings.host, port=settings.port)
