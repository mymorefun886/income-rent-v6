# Hermes Memory Service — PostgreSQL Store
# Direct DB access for qualitative memory (profile, preferences, events, decisions)

import asyncpg
from config import PG_DSN, MEMORY_SCHEMA

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(PG_DSN, min_size=1, max_size=10)
    return _pool


async def recall_profile(user_id: str) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT key, value, meta FROM {MEMORY_SCHEMA}.user_profile WHERE user_id = $1",
            user_id,
        )
    return {row["key"]: {"value": row["value"], "meta": row["meta"]} for row in rows}


async def recall_preferences(user_id: str, domain: str | None = None) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        if domain:
            rows = await conn.fetch(
                f"SELECT domain, key, value, weight, source FROM {MEMORY_SCHEMA}.preferences "
                f"WHERE user_id = $1 AND domain = $2 ORDER BY weight DESC",
                user_id, domain,
            )
        else:
            rows = await conn.fetch(
                f"SELECT domain, key, value, weight, source FROM {MEMORY_SCHEMA}.preferences "
                f"WHERE user_id = $1 ORDER BY weight DESC",
                user_id,
            )
    return [dict(r) for r in rows]


async def recall_events(user_id: str, domain: str | None = None, limit: int = 10) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        if domain:
            rows = await conn.fetch(
                f"SELECT id, event_type, domain, summary, detail, occurred_at "
                f"FROM {MEMORY_SCHEMA}.events "
                f"WHERE user_id = $1 AND domain = $2 ORDER BY occurred_at DESC LIMIT $3",
                user_id, domain, limit,
            )
        else:
            rows = await conn.fetch(
                f"SELECT id, event_type, domain, summary, detail, occurred_at "
                f"FROM {MEMORY_SCHEMA}.events "
                f"WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT $2",
                user_id, limit,
            )
    return [dict(r) for r in rows]


async def store_event(user_id: str, data: dict) -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"INSERT INTO {MEMORY_SCHEMA}.events (user_id, event_type, domain, summary, detail) "
            f"VALUES ($1, $2, $3, $4, $5) RETURNING id",
            user_id,
            data.get("type", "general"),
            data.get("domain", "general"),
            data.get("summary", data.get("message", "")),
            data.get("detail", "{}"),
        )
    return row["id"]


async def store_preference(user_id: str, domain: str, key: str, value: str, weight: float = 1.0) -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"INSERT INTO {MEMORY_SCHEMA}.preferences (user_id, domain, key, value, weight) "
            f"VALUES ($1, $2, $3, $4, $5) "
            f"ON CONFLICT (user_id, domain, key) DO UPDATE SET value=$4, weight=$5, updated_at=NOW() "
            f"RETURNING id",
            user_id, domain, key, value, weight,
        )
    return row["id"]


async def store_decision(user_id: str, data: dict) -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"INSERT INTO {MEMORY_SCHEMA}.decisions (user_id, domain, decision, rationale, alternatives) "
            f"VALUES ($1, $2, $3, $4, $5) RETURNING id",
            user_id,
            data.get("domain", "general"),
            data.get("decision", ""),
            data.get("rationale", ""),
            data.get("alternatives", "[]"),
        )
    return row["id"]
