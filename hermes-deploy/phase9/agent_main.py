# Hermes Agent — Entry Point
# Orchestration layer: session management, task lifecycle, MCP bridge.
# v1.5.2 — Session resume from context anchors for cross-session continuity.

from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel
import httpx
import uvicorn

from config import CORE_URL, KNOWLEDGE_URL, MEMORY_URL, TASK_STATES
from session import sessions
from task_lifecycle import lifecycle


@asynccontextmanager
async def lifespan(app: FastAPI):
    await sessions.connect()
    await lifecycle.connect()
    await lifecycle.ensure_schema()
    yield
    await sessions.disconnect()
    await lifecycle.disconnect()


app = FastAPI(title="Hermes Agent", version="1.5.2", lifespan=lifespan)


# -- Request models -----------------------------------------------------------

class ChatRequest(BaseModel):
    user_id: str = "default"
    message: str
    session_id: str = ""
    source: str = "agent"


class SearchRequest(BaseModel):
    user_id: str = "default"
    domain: str = "general"
    query: str
    filters: dict = {}
    limit: int = 5


# -- Helpers ------------------------------------------------------------------

async def _resume_from_anchors(user_id: str) -> dict:
    """Check for saved context anchors and active decisions to build resume context."""
    anchors = []
    decisions = []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{MEMORY_URL}/memory/context-anchors",
                json={"user_id": user_id},
            )
            resp.raise_for_status()
            data = resp.json()
            anchors = data.get("anchors", [])
            # Also fetch active decisions
            dec_resp = await client.get(
                f"{MEMORY_URL}/memory/decisions/{user_id}",
                params={"status": "active"},
            )
            dec_resp.raise_for_status()
            decisions = dec_resp.json().get("decisions", [])
            # Also check evaluating status
            eval_resp = await client.get(
                f"{MEMORY_URL}/memory/decisions/{user_id}",
                params={"status": "evaluating"},
            )
            eval_resp.raise_for_status()
            decisions.extend(eval_resp.json().get("decisions", []))
    except Exception:
        return {}

    if not anchors and not decisions:
        return {}

    # Use the highest-importance anchor as the primary resume context
    primary = anchors[0] if anchors else None
    active_decision_id = decisions[0]["id"] if decisions else None

    resume = {
        "resumed_from_anchor": bool(primary),
        "session_domain": primary.get("domain", "general") if primary else "general",
        "active_entity": ", ".join(primary.get("entities", [])) if primary else "",
        "last_intent": primary.get("context_data", {}).get("last_intent", "") if primary else "",
        "anchor_importance": primary.get("importance", 0) if primary else 0,
    }

    if active_decision_id:
        resume["active_decision_id"] = active_decision_id

    return resume


# -- Agent endpoints ----------------------------------------------------------

@app.post("/agent/chat")
async def agent_chat(req: ChatRequest):
    """Full pipeline: create/manage session → Core → response → task tracking."""
    # Session
    sid = req.session_id
    active = await sessions.get(sid) if sid else None
    resumed_from_anchor = False

    if active is None:
        # New session — try to resume from context anchors
        resume_ctx = await _resume_from_anchors(req.user_id)
        initial_domain = resume_ctx.get("session_domain", "general")

        active = await sessions.create(
            req.user_id,
            title=req.message[:40],
            domain=initial_domain,
        )
        sid = active["session_id"]

        # Seed session with anchor context if available
        if resume_ctx:
            resumed_from_anchor = True
            await sessions.update(sid,
                active_entity=resume_ctx.get("active_entity", ""),
                last_intent=resume_ctx.get("last_intent", ""),
                active_decision_id=resume_ctx.get("active_decision_id", ""),
            )
            active = await sessions.get(sid)

    await sessions.add_turn(sid, "user", req.message)

    # Session context for conversational continuity
    session_domain = active.get("domain", "general")
    session_entity = active.get("active_entity", "")
    last_intent = active.get("last_intent", "")
    active_decision_id = active.get("active_decision_id", "")

    # Task
    task = await lifecycle.create_task(req.user_id, session_id=sid, input_data={"message": req.message})

    # Core pipeline
    await lifecycle.transition(task["task_id"], "executing")
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{CORE_URL}/core/process",
            json={
                "user_id": req.user_id,
                "message": req.message,
                "source": req.source,
                "session_id": sid,
                "session_domain": session_domain,
                "active_entity": session_entity,
                "last_intent": last_intent,
                "active_decision_id": active_decision_id,
            },
        )
        resp.raise_for_status()
        result = resp.json()

    # Update session
    new_domain = result.get("domain", session_domain)
    new_entity = result.get("active_entity", "") or session_entity
    new_intent = result.get("intent", "")

    await sessions.update(sid,
        task_state="completed",
        domain=new_domain,
        active_entity=new_entity,
        last_intent=new_intent,
    )
    await sessions.add_turn(sid, "assistant", result.get("response", ""),
        metadata={
            "intent": new_intent,
            "domain": new_domain,
            "skill": result.get("skill", ""),
        },
    )

    # Complete task with full pipeline metadata
    await lifecycle.transition(task["task_id"], "completed", output={
        "response": result.get("response", ""),
        "intent": result.get("intent", ""),
        "domain": result.get("domain", ""),
        "skill": result.get("skill", ""),
        "confidence": result.get("confidence", 0),
        "elapsed_ms": result.get("elapsed_ms", 0),
        "preferences_recalled": result.get("preferences_recalled", 0),
        "memories_recalled": result.get("memories_recalled", 0),
        "active_entity": result.get("active_entity", ""),
    })

    return {
        "session_id": sid,
        "task_id": task["task_id"],
        "resumed_from_anchor": resumed_from_anchor,
        **result,
    }


@app.post("/agent/search")
async def agent_search(req: SearchRequest):
    """Knowledge search via Knowledge API."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{KNOWLEDGE_URL}/knowledge/search",
            json={"user_id": req.user_id, "domain": req.domain, "query": req.query,
                  "filters": req.filters, "limit": req.limit},
        )
        resp.raise_for_status()
        return resp.json()


@app.get("/agent/session/{session_id}")
async def get_session(session_id: str):
    s = await sessions.get(session_id)
    if s is None:
        return {"error": "session not found"}
    return s


@app.get("/agent/tasks/{user_id}")
async def list_tasks(user_id: str, limit: int = 20):
    tasks = await lifecycle.list_tasks(user_id, limit=limit)
    return {"user_id": user_id, "tasks": tasks}


@app.get("/agent/task/{task_id}")
async def get_task(task_id: str):
    t = await lifecycle.get_task(task_id)
    if t is None:
        return {"error": "task not found"}
    return t


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "hermes-agent",
        "task_states": list(TASK_STATES),
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
