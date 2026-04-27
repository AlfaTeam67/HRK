import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    try:
        engine = create_async_engine("postgresql+asyncpg://hrk:hrk_secret@localhost:5432/hrk_db")
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
