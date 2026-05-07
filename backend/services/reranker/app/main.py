from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from flashrank import Ranker, RerankRequest
from pydantic import BaseModel


class Document(BaseModel):
    id: str
    text: str


class RerankRequestModel(BaseModel):
    query: str
    documents: list[Document]


# Global state for the model
ml_models = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the FlashRank model on startup.
    # ms-marco-MultiBERT-L-12 is a good multilingual choice.
    ml_models["ranker"] = Ranker(model_name="ms-marco-MultiBERT-L-12", cache_dir="/app/models")
    yield
    # Clean up on shutdown
    ml_models.clear()


app = FastAPI(title="Reranker API", lifespan=lifespan)


@app.post("/api/rerank")
async def rerank(request: RerankRequestModel) -> list[dict[str, Any]]:
    ranker: Ranker | None = ml_models.get("ranker")
    if not ranker:
        raise HTTPException(status_code=500, detail="Ranker model not loaded")

    # Format documents for FlashRank
    passages = [{"id": doc.id, "text": doc.text} for doc in request.documents]
    
    # Create FlashRank request
    rerankreq = RerankRequest(query=request.query, passages=passages)
    
    # Run the reranker
    results = ranker.rerank(rerankreq)
    
    # FlashRank returns a list of dicts: [{'id': ..., 'text': ..., 'score': ...}, ...]
    # Convert numpy types to native Python types for JSON serialization
    return [
        {k: (v.item() if hasattr(v, "item") else v) for k, v in result.items()}
        for result in results
    ]

@app.get("/health")
async def health_check():
    if "ranker" in ml_models:
        return {"status": "healthy"}
    return {"status": "starting"}
