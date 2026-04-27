from fastapi import FastAPI

from app.controllers.ad_controller import router as ad_router

app = FastAPI(title="HRK AD Service", version="0.1.0")
app.include_router(ad_router)
