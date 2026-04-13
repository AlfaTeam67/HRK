"""Verify project structure changes."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

# Test imports
try:
    from app.config import settings
    print("✓ Settings import from app.config works")
    print(f"  - app_name: {settings.app_name}")
    print(f"  - app_version: {settings.app_version}")
    print(f"  - host: {settings.host}")
    print(f"  - port: {settings.port}")
except Exception as e:
    print(f"✗ Settings import failed: {e}")
    sys.exit(1)

try:
    from app.models import Base
    print("✓ Base import from app.models works")
except Exception as e:
    print(f"✗ Base import failed: {e}")
    sys.exit(1)

try:
    from app.core.database import get_db, AsyncSessionLocal
    print("✓ Database imports work")
except Exception as e:
    print(f"✗ Database import failed: {e}")
    sys.exit(1)

print("\n✓ All imports successful!")
