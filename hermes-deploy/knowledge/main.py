# Hermes Knowledge Service — Entry Point
# FastAPI service: domain-isolated vector search backed by Qdrant.

from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

from config import DOMAIN_COLLECTIONS, VECTOR_SIZE
from models import KnowledgeResult
from qdrant_store import ensure_collections, search, upsert


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_collections()
    yield


app = FastAPI(title="Hermes Knowledge", version="1.5.0", lifespan=lifespan)


class SearchRequest(BaseModel):
    user_id: str = "default"
    domain: str = "general"
    query: str
    filters: dict = {}
    limit: int = 10


class UpsertRequest(BaseModel):
    domain: str
    point_id: str
    vector: list[float]
    payload: dict = {}


@app.post("/knowledge/search")
async def search_knowledge(req: SearchRequest):
    """Search a domain collection. Returns evidence documents with scores and provenance."""
    result = search(
        domain=req.domain,
        query_text=req.query,
        filters=req.filters,
        limit=req.limit,
    )
    return {
        "domain": result.domain,
        "documents": [
            {
                "content": d.content,
                "source": d.source,
                "score": d.score,
                "metadata": d.metadata,
            }
            for d in result.documents
        ],
        "confidence": result.confidence,
    }


@app.post("/knowledge/upsert")
async def upsert_knowledge(req: UpsertRequest):
    """Insert a vector point into a domain collection."""
    upsert(req.domain, req.point_id, req.vector, req.payload)
    return {"status": "ok", "point_id": req.point_id, "domain": req.domain}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "hermes-knowledge",
        "vector_size": VECTOR_SIZE,
        "collections": list(DOMAIN_COLLECTIONS.values()),
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
