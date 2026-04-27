"""Pytest configuration for backend tests."""

import os

# Required settings consumed at import time by app.config.Settings.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("S3_ACCESS_KEY", "test")
os.environ.setdefault("S3_SECRET_KEY", "test")
os.environ.setdefault("DEBUG", "true")
