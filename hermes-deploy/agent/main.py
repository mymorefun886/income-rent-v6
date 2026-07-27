# Hermes Agent — Entry Point
# Orchestration layer: session management, task lifecycle, MCP bridge.

from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel
import httpx
import uvicorn

from config import CORE_URL, KNOWLEDGE_URL, TASK_STATES
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


app = FastAPI(title="Hermes Agent", version="1.5.0", lifespan=lifespan)


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


class RecallRequest(BaseModel):
    user_id: str = "default"
    domain: str = "general"
    limit: int = 10


# -- Agent endpoints ----------------------------------------------------------

@app.post("/agent/chat")
async def agent_chat(req: ChatRequest):
    """Full pipeline: create/manage session → Core → response → task tracking."""
    # Session
    sid = req.session_id
    active = await sessions.get(sid) if sid else None
    if active is None:
        active = await sessions.create(req.user_id, title=req.message[:40], domain="general")
        sid = active["session_id"]

    await sessions.add_turn(sid, "user", req.message)

    # Task
    task = await lifecycle.create_task(req.user_id, session_id=sid, input_data={"message": req.message})

    # Core pipeline
    await lifecycle.transition(task["task_id"], "executing")
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{CORE_URL}/core/process",
            json={"user_id": req.user_id, "message": req.message, "source": req.source},
        )
        resp.raise_for_status()
        result = resp.json()

    # Update session with response
    await sessions.update(sid, task_state="completed", domain=result.get("domain", "general"))
    await sessions.add_turn(sid, "assistant", result.get("response", ""))

    # Complete task
    await lifecycle.transition(task["task_id"], "completed", output=result)

    return {
        "session_id": sid,
        "task_id": task["task_id"],
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
    """Get session state."""
    s = await sessions.get(session_id)
    if s is None:
        return {"error": "session not found"}
    return s


@app.get("/agent/tasks/{user_id}")
async def list_tasks(user_id: str, limit: int = 20):
    """List recent tasks for a user."""
    tasks = await lifecycle.list_tasks(user_id, limit=limit)
    return {"user_id": user_id, "tasks": tasks}


@app.get("/agent/task/{task_id}")
async def get_task(task_id: str):
    """Get task details."""
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
