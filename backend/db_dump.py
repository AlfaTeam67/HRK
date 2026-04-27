import asyncio
import sys
import os

# Add src to sys.path to allow importing app.config
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import settings

async def main():
    try:
        engine = create_async_engine(settings.database_url)
        async with engine.connect() as conn:
            users = await conn.execute(text("SELECT id, is_active FROM users"))
            print("Users:", users.fetchall())
            cust = await conn.execute(text("SELECT id, company_id FROM customers"))
            print("Customers:", cust.fetchall())
            comp = await conn.execute(text("SELECT id FROM companies"))
            print("Companies:", comp.fetchall())
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
