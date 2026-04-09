"""HRK Backend Application - App Factory"""
from app.core.config import Settings
from app.core.app import create_app

__all__ = ["create_app", "Settings"]
