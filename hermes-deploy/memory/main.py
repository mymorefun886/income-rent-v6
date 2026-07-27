# Hermes Memory Service — Entry Point
# FastAPI service: /memory/recall, /memory/store, /memory/search

from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

from pg_store import (
    recall_profile, recall_preferences, recall_events,
    store_event, store_preference, store_decision,
)
from qdrant_store import search_vectors


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Hermes Memory", version="1.5.0", lifespan=lifespan)


class RecallRequest(BaseModel):
    user_id: str = "default"
    domain: str | None = None
    limit: int = 10


class StoreRequest(BaseModel):
    user_id: str = "default"
    type: str = "event"  # event | preference | decision
    data: dict = {}


class SearchRequest(BaseModel):
    user_id: str = "default"
    query: str = ""
    domain: str | None = None
    limit: int = 5


@app.post("/memory/recall")
async def recall(req: RecallRequest):
    """Recall full user context: profile + preferences + recent events."""
    profile = await recall_profile(req.user_id)
    preferences = await recall_preferences(req.user_id, req.domain)
    events = await recall_events(req.user_id, req.domain, req.limit)
    return {
        "user_id": req.user_id,
        "profile": profile,
        "preferences": preferences,
        "events": events,
    }


@app.post("/memory/store")
async def store(req: StoreRequest):
    """Store a memory: event, preference, or decision."""
    result = {"user_id": req.user_id, "type": req.type}

    if req.type == "event":
        eid = await store_event(req.user_id, req.data)
        result["id"] = eid
    elif req.type == "preference":
        pid = await store_preference(
            req.user_id,
            req.data.get("domain", "general"),
            req.data.get("key", ""),
            req.data.get("value", ""),
            req.data.get("weight", 1.0),
        )
        result["id"] = pid
    elif req.type == "decision":
        did = await store_decision(req.user_id, req.data)
        result["id"] = did
    else:
        result["error"] = f"Unknown type: {req.type}"

    return result


@app.post("/memory/search")
async def search(req: SearchRequest):
    """Semantic search — returns results from vector similarity.

    Note: requires embedding model integration for query_vector generation.
    Currently returns empty until embedding pipeline is wired in.
    """
    # Placeholder: real implementation needs embedding model to convert query → vector
    return {
        "user_id": req.user_id,
        "query": req.query,
        "results": [],
        "note": "Embedding model not yet wired — returns empty until Phase 4",
    }


@app.get("/health")
async def health():
    return {"status": "ok", "service": "hermes-memory"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
