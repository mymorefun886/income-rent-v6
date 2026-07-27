# Hermes Core — Entry Point
# FastAPI service exposing the Core control plane

from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

from context import TaskContext
from task import process
from skills.registry import registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: discover skills. Shutdown: no-op."""
    registry.discover()
    yield


app = FastAPI(title="Hermes Core", version="1.5.0", lifespan=lifespan)


class Request(BaseModel):
    user_id: str = "default"
    message: str
    source: str = "api"
    session_id: str = ""
    session_domain: str = "general"
    active_entity: str = ""
    last_intent: str = ""
    active_decision_id: str = ""


@app.post("/core/process")
async def process_request(req: Request):
    """Main entry point: receive message, run pipeline, return response."""
    ctx = TaskContext(
        user_id=req.user_id,
        raw_message=req.message,
        source=req.source,
        session_id=req.session_id,
        session_domain=req.session_domain,
        active_entity=req.active_entity or None,
        last_intent=req.last_intent or None,
        active_decision_id=req.active_decision_id or None,
    )
    await process(ctx)
    return {
        "intent": ctx.intent,
        "confidence": ctx.intent_confidence,
        "domain": ctx.domain,
        "skill": ctx.selected_skill,
        "response": ctx.response,
        "active_entity": ctx.active_entity,
        "preferences_recalled": len(ctx.recalled_preferences),
        "memories_recalled": len(ctx.recalled_memories),
        "elapsed_ms": round(ctx.elapsed_ms, 2),
        "active_decision_id": ctx.active_decision_id or "",
    }


class FeedbackRequest(BaseModel):
    user_id: str = "default"
    session_id: str = ""
    school_id: str = ""
    result_id: str = ""  # recommendation_result_id (preferred — preserves decision context)
    feedback_type: str = ""  # accepted, rejected, shortlisted, ignored
    action: str = ""  # alias for feedback_type
    reason: str | None = None  # too_far, tuition, academic_fit, school_culture, child_preference, other
    comment: str | None = None  # natural language feedback (will be parsed if feedback_type empty)
    rating: int | None = None


@app.post("/education/feedback")
async def submit_feedback(req: FeedbackRequest):
    """Submit parent feedback on a recommendation.

    Supports:
    - Explicit feedback_type (API clients, Telegram buttons)
    - Natural language comment ("呢間太遠" → parsed automatically)
    - result_id binding (preserves decision context)

    Captures decision outcome and stores in preference memory.
    Does NOT directly modify ranking weights.
    """
    import asyncpg
    import os

    pg_host = os.environ.get("POSTGRES_HOST", "hermes-postgres")
    pg_port = int(os.environ.get("POSTGRES_PORT", "5432"))
    pg_user = os.environ.get("POSTGRES_USER", "hermes")
    pg_pass = os.environ.get("POSTGRES_PASSWORD", "")
    pg_db = os.environ.get("POSTGRES_DB", "hermes")

    conn = await asyncpg.connect(
        host=pg_host, port=pg_port, user=pg_user,
        password=pg_pass, database=pg_db, ssl=False
    )

    try:
        from skills.education.engine.feedback_capture import (
            FeedbackCapture, FeedbackEvent, get_feedback_capture
        )
        from skills.education.engine.feedback_intent_parser import (
            parse_feedback_intent, is_feedback_message
        )

        capture = get_feedback_capture(conn)

        # Resolve result_id → school_id if provided
        school_id = req.school_id
        if req.result_id:
            row = await conn.fetchrow(
                "SELECT school_id FROM memory.recommendation_result WHERE id = $1",
                req.result_id,
            )
            if row:
                school_id = row["school_id"]

        # Handle empty session_id / result_id (not all feedback has a session context)
        session_id = req.session_id if req.session_id else None

        # Normalize feedback_type (action is alias)
        feedback_type = req.feedback_type or req.action
        reason = req.reason

        # If no explicit feedback_type but comment provided, parse intent
        if not feedback_type and req.comment:
            intent = parse_feedback_intent(req.comment)
            feedback_type = intent.feedback_type or None
            if not reason and intent.reason:
                reason = intent.reason

        # Validate feedback_type (must be in valid set, not empty or unknown)
        if not feedback_type or feedback_type == "unknown":
            return {
                "status": "error",
                "message": f"Cannot parse feedback intent from comment. Please specify feedback_type explicitly.",
                "valid_types": ["accepted", "rejected", "shortlisted", "ignored"],
            }

        from skills.education.presentation.locale import detect_locale

        # Phase 10.1.7-E: Detect locale for feedback learning
        feedback_locale = detect_locale(req.comment) if req.comment else "zh-TW"

        event = FeedbackEvent(
            user_id=req.user_id,
            session_id=session_id or "",
            school_id=school_id,
            feedback_type=feedback_type,
            reason=reason,
            comment=req.comment,
            rating=req.rating,
            locale=feedback_locale,
        )
        feedback_id = await capture.capture_feedback(event)

        return {
            "status": "ok",
            "feedback_id": feedback_id,
            "feedback_type": feedback_type,
            "reason": reason,
            "message": "Feedback captured. Preference memory updated.",
        }
    finally:
        await conn.close()


class PreferenceResponse(BaseModel):
    user_id: str = "default"


@app.get("/education/preferences/{user_id}")
async def get_preferences(user_id: str):
    """Get user preference memory for display/debugging."""
    import asyncpg
    import os

    pg_host = os.environ.get("POSTGRES_HOST", "hermes-postgres")
    pg_port = int(os.environ.get("POSTGRES_PORT", "5432"))
    pg_user = os.environ.get("POSTGRES_USER", "hermes")
    pg_pass = os.environ.get("POSTGRES_PASSWORD", "")
    pg_db = os.environ.get("POSTGRES_DB", "hermes")

    conn = await asyncpg.connect(
        host=pg_host, port=pg_port, user=pg_user,
        password=pg_pass, database=pg_db, ssl=False
    )

    try:
        from skills.education.engine.feedback_capture import get_feedback_capture

        capture = get_feedback_capture(conn)
        prefs = await capture.get_user_preferences(user_id)

        return {
            "user_id": user_id,
            "preferences": prefs,
            "count": len(prefs),
        }
    finally:
        await conn.close()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "hermes-core", "skills": registry.skill_names}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
