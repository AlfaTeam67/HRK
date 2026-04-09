"""FastAPI application factory."""
from fastapi import FastAPI

from app.core.config import settings


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
    )

    @app.get("/health", tags=["health"])
    async def healthcheck() -> dict[str, str]:
        """Health check endpoint."""
        return {"status": "ok", "app": settings.app_name}

    return app
