# Hermes Memory Service — Entry Point
# FastAPI service: /memory/recall, /memory/store, /memory/search, /memory/context-anchor

from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

from pg_store import (
    ensure_schema,
    recall_profile, recall_preferences, recall_events,
    store_event, store_preference, store_decision,
    upsert_context_anchor, get_context_anchors, delete_context_anchor,
    create_decision, get_decision, list_decisions, update_decision_status,
    add_decision_entity, remove_decision_entity,
    add_decision_factor, remove_decision_factor,
)
from qdrant_store import search_vectors


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_schema()
    yield


app = FastAPI(title="Hermes Memory", version="1.5.1", lifespan=lifespan)


class RecallRequest(BaseModel):
    user_id: str = "default"
    domain: str | None = None
    limit: int = 10


class StoreRequest(BaseModel):
    user_id: str = "default"
    type: str = "event"
    data: dict = {}


class SearchRequest(BaseModel):
    user_id: str = "default"
    query: str = ""
    domain: str | None = None
    limit: int = 5


class ContextAnchorRequest(BaseModel):
    user_id: str = "default"
    domain: str = "general"
    anchor_type: str = "decision_context"
    entities: list = []
    context_data: dict = {}
    importance: float = 0.5


class ContextAnchorQuery(BaseModel):
    user_id: str = "default"
    domain: str | None = None


class CreateDecisionRequest(BaseModel):
    user_id: str = "default"
    domain: str = "education"
    decision_type: str = "secondary_school_selection"
    title: str | None = None


class AddEntityRequest(BaseModel):
    entity_type: str
    entity_value: str
    role: str = "candidate"


class AddFactorRequest(BaseModel):
    factor: str
    value: dict = {}
    weight: float = 0.5
    source: str = "user"


class UpdateStatusRequest(BaseModel):
    status: str


@app.post("/memory/recall")
async def recall(req: RecallRequest):
    """Recall full user context: profile + preferences + recent events + context anchors."""
    profile = await recall_profile(req.user_id)
    preferences = await recall_preferences(req.user_id, req.domain)
    events = await recall_events(req.user_id, req.domain, req.limit)
    anchors = await get_context_anchors(req.user_id, req.domain)
    return {
        "user_id": req.user_id,
        "profile": profile,
        "preferences": preferences,
        "events": events,
        "anchors": anchors,
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


@app.post("/memory/context-anchor")
async def save_context_anchor(req: ContextAnchorRequest):
    """Upsert a context anchor — persists decision context across sessions."""
    aid = await upsert_context_anchor(
        req.user_id, req.domain, req.anchor_type,
        req.entities, req.context_data, req.importance,
    )
    return {"id": aid, "user_id": req.user_id, "domain": req.domain}


@app.post("/memory/context-anchors")
async def query_context_anchors(req: ContextAnchorQuery):
    """Retrieve context anchors for a user."""
    anchors = await get_context_anchors(req.user_id, req.domain)
    return {"user_id": req.user_id, "anchors": anchors}


# ── Decision Context (Phase 9.2.2) ─────────────────────────────

@app.post("/memory/decision/create")
async def decision_create(req: CreateDecisionRequest):
    """Create a new decision context."""
    result = await create_decision(
        req.user_id, req.domain, req.decision_type, req.title,
    )
    return {"user_id": req.user_id, **result}


@app.get("/memory/decision/{decision_id}")
async def decision_get(decision_id: str):
    """Get full decision context with entities and factors."""
    d = await get_decision(decision_id)
    if d is None:
        return {"error": "decision not found"}
    return d


@app.get("/memory/decisions/{user_id}")
async def decisions_list(user_id: str, domain: str | None = None, status: str | None = None):
    """List decisions for a user, optionally filtered."""
    decisions = await list_decisions(user_id, domain=domain, status=status)
    return {"user_id": user_id, "decisions": decisions}


@app.post("/memory/decision/{decision_id}/entity")
async def decision_add_entity(decision_id: str, req: AddEntityRequest):
    """Add an entity to a decision."""
    result = await add_decision_entity(
        decision_id, req.entity_type, req.entity_value, req.role,
    )
    return {"decision_id": decision_id, **result}


@app.delete("/memory/decision/{decision_id}/entity/{entity_id}")
async def decision_remove_entity(decision_id: str, entity_id: str):
    """Remove an entity from a decision."""
    ok = await remove_decision_entity(entity_id)
    return {"decision_id": decision_id, "entity_id": entity_id, "removed": ok}


@app.post("/memory/decision/{decision_id}/factor")
async def decision_add_factor(decision_id: str, req: AddFactorRequest):
    """Add a decision factor with weight."""
    result = await add_decision_factor(
        decision_id, req.factor, req.value, req.weight, req.source,
    )
    return {"decision_id": decision_id, **result}


@app.delete("/memory/decision/{decision_id}/factor/{factor_id}")
async def decision_remove_factor(decision_id: str, factor_id: str):
    """Remove a factor from a decision."""
    ok = await remove_decision_factor(factor_id)
    return {"decision_id": decision_id, "factor_id": factor_id, "removed": ok}


@app.patch("/memory/decision/{decision_id}/status")
async def decision_update_status(decision_id: str, req: UpdateStatusRequest):
    """Transition a decision to a new status (enforces state machine)."""
    try:
        result = await update_decision_status(decision_id, req.status)
        return {"decision_id": decision_id, **result}
    except ValueError as e:
        return {"error": str(e)}


@app.post("/memory/search")
async def search(req: SearchRequest):
    return {
        "user_id": req.user_id,
        "query": req.query,
        "results": [],
        "note": "Embedding model not yet wired",
    }


@app.get("/health")
async def health():
    return {"status": "ok", "service": "hermes-memory"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
