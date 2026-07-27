# Hermes Agent — Task Lifecycle
# PostgreSQL-backed state machine for task tracking.

import json
import uuid
from datetime import datetime, timezone

import asyncpg

from config import PG_DSN, AGENT_SCHEMA


class TaskLifecycle:
    """Tracks task state: received → planning → executing → completed → failed."""

    def __init__(self):
        self.pool: asyncpg.Pool | None = None

    async def connect(self):
        self.pool = await asyncpg.create_pool(PG_DSN, min_size=1, max_size=5)

    async def disconnect(self):
        if self.pool:
            await self.pool.close()

    async def ensure_schema(self):
        """Create agent schema and tables if they don't exist."""
        async with self.pool.acquire() as conn:
            await conn.execute(f"CREATE SCHEMA IF NOT EXISTS {AGENT_SCHEMA}")
            await conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {AGENT_SCHEMA}.sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT,
                    domain TEXT DEFAULT 'general',
                    task_state TEXT DEFAULT 'received',
                    context JSONB DEFAULT '{{}}',
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """)
            await conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {AGENT_SCHEMA}.tasks (
                    task_id TEXT PRIMARY KEY,
                    session_id TEXT,
                    user_id TEXT NOT NULL,
                    intent TEXT,
                    domain TEXT DEFAULT 'general',
                    status TEXT DEFAULT 'received',
                    input JSONB DEFAULT '{{}}',
                    output JSONB DEFAULT '{{}}',
                    elapsed_ms REAL DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    completed_at TIMESTAMPTZ
                )
            """)
            await conn.execute(f"""
                CREATE INDEX IF NOT EXISTS idx_tasks_user_time
                ON {AGENT_SCHEMA}.tasks (user_id, created_at DESC)
            """)

    async def create_task(self, user_id: str, session_id: str = "", intent: str = "",
                          domain: str = "general", input_data: dict | None = None) -> dict:
        task_id = str(uuid.uuid4())[:8]
        now = datetime.now(timezone.utc)
        async with self.pool.acquire() as conn:
            await conn.execute(
                f"INSERT INTO {AGENT_SCHEMA}.tasks (task_id, session_id, user_id, intent, domain, status, input, created_at) "
                f"VALUES ($1, $2, $3, $4, $5, 'received', $6::jsonb, $7)",
                task_id, session_id, user_id, intent, domain,
                json.dumps(input_data or {}, ensure_ascii=False), now,
            )
        return {"task_id": task_id, "status": "received"}

    async def transition(self, task_id: str, new_status: str, output: dict | None = None):
        now = datetime.now(timezone.utc)
        extra = ""
        if new_status in ("completed", "failed"):
            extra = f", completed_at = '{now.isoformat()}'"
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                f"UPDATE {AGENT_SCHEMA}.tasks SET status = $1, output = $2::jsonb{extra} "
                f"WHERE task_id = $3",
                new_status, json.dumps(output or {}, ensure_ascii=False), task_id,
            )
        return {"task_id": task_id, "status": new_status}

    async def get_task(self, task_id: str) -> dict | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                f"SELECT task_id, session_id, user_id, intent, domain, status, input, output, "
                f"elapsed_ms, created_at, completed_at FROM {AGENT_SCHEMA}.tasks WHERE task_id = $1",
                task_id,
            )
        if row is None:
            return None
        return dict(row)

    async def list_tasks(self, user_id: str, limit: int = 20) -> list[dict]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT task_id, session_id, user_id, intent, domain, status, "
                f"elapsed_ms, created_at, completed_at "
                f"FROM {AGENT_SCHEMA}.tasks WHERE user_id = $1 "
                f"ORDER BY created_at DESC LIMIT $2",
                user_id, limit,
            )
        return [dict(r) for r in rows]


# Singleton
lifecycle = TaskLifecycle()
