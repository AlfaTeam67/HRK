"""Application configuration using Pydantic Settings v2."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "HRK Backend"
    app_version: str = "0.1.0"
    debug: bool = False
    api_v1_str: str = "/api/v1"

    # Database
    database_url: str = "sqlite:///./app.db"

    # Server
    host: str = "127.0.0.1"
    port: int = 8000

    # CORS
    fe_domain: str = "http://localhost:3000"
    allowed_hosts: list[str] = ["localhost", "127.0.0.1"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
