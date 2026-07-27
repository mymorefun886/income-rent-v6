# Hermes Agent — Session Manager
# Redis-backed session store with TTL. Keeps conversation context across turns.

import json
import uuid
from datetime import datetime, timezone

import redis.asyncio as redis

from config import REDIS_URL, SESSION_TTL


class SessionManager:
    """Manages conversation sessions in Redis."""

    def __init__(self):
        self.redis: redis.Redis | None = None

    async def connect(self):
        self.redis = redis.from_url(REDIS_URL, decode_responses=True)

    async def disconnect(self):
        if self.redis:
            await self.redis.aclose()

    def _key(self, session_id: str) -> str:
        return f"session:{session_id}"

    async def create(self, user_id: str, title: str = "", domain: str = "general") -> dict:
        """Start a new session."""
        sid = str(uuid.uuid4())[:8]
        now = datetime.now(timezone.utc).isoformat()
        session = {
            "session_id": sid,
            "user_id": user_id,
            "title": title or "New session",
            "domain": domain,
            "task_state": "received",
            "turn": 0,
            "history": [],
            "created_at": now,
            "updated_at": now,
        }
        await self.redis.setex(self._key(sid), SESSION_TTL, json.dumps(session, ensure_ascii=False))
        return session

    async def get(self, session_id: str) -> dict | None:
        raw = await self.redis.get(self._key(session_id))
        if raw is None:
            return None
        return json.loads(raw)

    async def update(self, session_id: str, **fields):
        session = await self.get(session_id)
        if session is None:
            return None
        session.update(fields)
        session["updated_at"] = datetime.now(timezone.utc).isoformat()
        await self.redis.setex(self._key(session_id), SESSION_TTL, json.dumps(session, ensure_ascii=False))
        return session

    async def add_turn(self, session_id: str, role: str, content: str, metadata: dict | None = None):
        session = await self.get(session_id)
        if session is None:
            return None
        session["turn"] += 1
        session["history"].append({
            "turn": session["turn"],
            "role": role,
            "content": content[:500],
            "metadata": metadata or {},
            "at": datetime.now(timezone.utc).isoformat(),
        })
        # Keep last 20 turns
        if len(session["history"]) > 20:
            session["history"] = session["history"][-20:]
        session["updated_at"] = datetime.now(timezone.utc).isoformat()
        await self.redis.setex(self._key(session_id), SESSION_TTL, json.dumps(session, ensure_ascii=False))
        return session

    async def delete(self, session_id: str):
        await self.redis.delete(self._key(session_id))


# Singleton
sessions = SessionManager()
