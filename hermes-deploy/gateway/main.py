# Hermes Gateway — Entry Point
# Thin routing layer. No intelligence — just forwards to Core.

from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import httpx
import uvicorn

from config import CORE_URL


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Hermes Gateway", version="1.5.0", lifespan=lifespan)


class Message(BaseModel):
    user_id: str = "default"
    message: str
    source: str = "api"


class FeedbackRequest(BaseModel):
    user_id: str = "default"
    session_id: str = ""
    school_id: str = ""
    result_id: str = ""  # recommendation_result_id (preferred over school_id)
    feedback_type: str = ""  # accepted, rejected, shortlisted, ignored
    action: str = ""  # alias for feedback_type (Telegram UX)
    reason: Optional[str] = None  # too_far, tuition, academic_fit, school_culture, child_preference, other
    comment: Optional[str] = None
    rating: Optional[int] = None


@app.post("/gateway/message")
async def handle_message(msg: Message):
    """Forward message to Core, return response."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{CORE_URL}/core/process",
            json={"user_id": msg.user_id, "message": msg.message, "source": msg.source},
        )
        resp.raise_for_status()
        return resp.json()


@app.post("/gateway/education/feedback")
async def handle_education_feedback(req: FeedbackRequest):
    """Forward education feedback to Core's feedback capture endpoint.

    Supports both:
    - Explicit feedback_type (API clients)
    - action alias (Telegram buttons: accepted/rejected/shortlisted)
    """
    # Normalize: action is alias for feedback_type
    feedback_type = req.feedback_type or req.action

    payload = {
        "user_id": req.user_id,
        "feedback_type": feedback_type,
        "reason": req.reason,
        "comment": req.comment,
        "rating": req.rating,
    }

    # Only include non-empty fields
    if req.session_id:
        payload["session_id"] = req.session_id
    if req.school_id:
        payload["school_id"] = req.school_id
    if req.result_id:
        payload["result_id"] = req.result_id

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{CORE_URL}/education/feedback",
            json=payload,
        )

        if resp.status_code >= 400:
            return {
                "status": "error",
                "code": resp.status_code,
                "message": resp.text[:500],
            }

        data = resp.json()
        data["_gateway"] = True
        return data


@app.get("/health")
async def health():
    return {"status": "ok", "service": "hermes-gateway"}


@app.get("/gateway/education/preferences/{user_id}")
async def get_preferences(user_id: str):
    """Get user preference memory (proxies core endpoint)."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{CORE_URL}/education/preferences/{user_id}")
        if resp.status_code >= 400:
            return {"status": "error", "code": resp.status_code, "message": resp.text[:500]}
        data = resp.json()
        data["_gateway"] = True
        return data


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
