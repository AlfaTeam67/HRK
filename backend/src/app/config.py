"""Application configuration using Pydantic Settings v2."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "HRK Backend"
    app_version: str = "0.1.0"
    debug: bool = False
    api_v1_str: str = "/api/v1"

    # Database (PostgreSQL + pgvector) — required
    database_url: str = Field(..., min_length=1)

    # Server
    host: str = "127.0.0.1"
    port: int = 8000

    # CORS
    fe_domain: str = "http://localhost:3000"
    allowed_hosts: list[str] = ["localhost", "127.0.0.1"]

    # AD integration
    ad_service_url: str = "http://localhost:8001"
    api_ad_domain: str = "HRK"
    ad_request_timeout: float = 5.0

    # S3 / MinIO — credentials required
    s3_endpoint: str = "http://localhost:9000"
    s3_external_endpoint: str | None = None
    s3_bucket: str = "hrk-documents"
    s3_access_key: str = Field(..., min_length=1)
    s3_secret_key: str = Field(..., min_length=1)
    s3_region: str = "us-east-1"
    s3_sse_enabled: bool = True
    s3_sse_algorithm: str = "AES256"
    s3_require_private_bucket: bool = True
    document_max_file_size_bytes: int = 10 * 1024 * 1024
    document_presigned_url_ttl_seconds: int = 300

    # Ollama (embeddings)
    ollama_url: str = "http://localhost:11434"
    ollama_embed_model: str = "nomic-embed-text"

    # OpenRouter (AI mode — swap base_url to ollama /v1 when switching to local)
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "google/gemma-4-31b-it:free"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()  # type: ignore[call-arg]
