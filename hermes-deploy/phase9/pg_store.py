# Hermes Memory Service — PostgreSQL Store
# Direct DB access for qualitative memory (profile, preferences, events, decisions, context_anchors)

import json

import asyncpg
from config import PG_DSN, MEMORY_SCHEMA

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(PG_DSN, min_size=1, max_size=10)
    return _pool


async def ensure_schema():
    """Create tables if they don't exist — called at startup."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(f"CREATE SCHEMA IF NOT EXISTS {MEMORY_SCHEMA}")
        # Existing tables
        await conn.execute(f"""
            CREATE TABLE IF NOT EXISTS {MEMORY_SCHEMA}.user_profile (
                id SERIAL PRIMARY KEY, user_id TEXT NOT NULL,
                key TEXT NOT NULL, value TEXT, meta JSONB DEFAULT '{{}}',
                created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
                UNIQUE(user_id, key)
            )
        """)
        await conn.execute(f"""
            CREATE TABLE IF NOT EXISTS {MEMORY_SCHEMA}.preferences (
                id SERIAL PRIMARY KEY, user_id TEXT NOT NULL,
                domain TEXT NOT NULL DEFAULT 'general', key TEXT NOT NULL,
                value TEXT, weight REAL DEFAULT 1.0, source TEXT DEFAULT 'manual',
                created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
                UNIQUE(user_id, domain, key)
            )
        """)
        await conn.execute(f"""
            CREATE TABLE IF NOT EXISTS {MEMORY_SCHEMA}.events (
                id SERIAL PRIMARY KEY, user_id TEXT NOT NULL,
                event_type TEXT DEFAULT 'general', domain TEXT DEFAULT 'general',
                summary TEXT, detail JSONB DEFAULT '{{}}',
                occurred_at TIMESTAMPTZ DEFAULT now()
            )
        """)
        await conn.execute(f"""
            CREATE TABLE IF NOT EXISTS {MEMORY_SCHEMA}.decisions (
                id SERIAL PRIMARY KEY, user_id TEXT NOT NULL,
                domain TEXT DEFAULT 'general', decision TEXT,
                rationale TEXT, alternatives JSONB DEFAULT '[]',
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """)
        # New: context anchors for long-term decision state
        await conn.execute(f"""
            CREATE TABLE IF NOT EXISTS {MEMORY_SCHEMA}.context_anchors (
                id SERIAL PRIMARY KEY, user_id TEXT NOT NULL,
                domain TEXT NOT NULL DEFAULT 'general',
                anchor_type TEXT NOT NULL DEFAULT 'decision_context',
                entities JSONB DEFAULT '[]',
                context_data JSONB DEFAULT '{{}}',
                importance REAL DEFAULT 0.5,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now(),
                last_accessed TIMESTAMPTZ DEFAULT now(),
                UNIQUE(user_id, domain)
            )
        """)
        # Phase 9.2.2: Decision Model — lifecycle-managed decision cases
        await conn.execute(f"""
            CREATE TABLE IF NOT EXISTS {MEMORY_SCHEMA}.decision_context (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT NOT NULL,
                domain TEXT NOT NULL,
                decision_type TEXT NOT NULL,
                title TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                priority REAL DEFAULT 0.5,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now(),
                closed_at TIMESTAMPTZ
            )
        """)
        await conn.execute(f"""
            CREATE TABLE IF NOT EXISTS {MEMORY_SCHEMA}.decision_entities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                decision_id UUID NOT NULL REFERENCES {MEMORY_SCHEMA}.decision_context(id) ON DELETE CASCADE,
                entity_type TEXT NOT NULL,
                entity_value TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'candidate',
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """)
        await conn.execute(f"""
            CREATE TABLE IF NOT EXISTS {MEMORY_SCHEMA}.decision_factors (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                decision_id UUID NOT NULL REFERENCES {MEMORY_SCHEMA}.decision_context(id) ON DELETE CASCADE,
                factor TEXT NOT NULL,
                value JSONB DEFAULT '{{}}',
                weight REAL DEFAULT 0.5,
                source TEXT DEFAULT 'user',
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """)
        # Index for listing active decisions per user
        await conn.execute(f"""
            CREATE INDEX IF NOT EXISTS idx_decision_context_user_status
            ON {MEMORY_SCHEMA}.decision_context(user_id, status)
        """)
        # Unique constraint to prevent duplicate entities within a decision
        await conn.execute(f"""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_decision_entities_unique
            ON {MEMORY_SCHEMA}.decision_entities(decision_id, entity_type, entity_value, role)
        """)
        # Unique constraint to prevent duplicate factors within a decision
        await conn.execute(f"""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_decision_factors_unique
            ON {MEMORY_SCHEMA}.decision_factors(decision_id, factor)
        """)


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
        if domain and domain != "general":
            rows = await conn.fetch(
                f"SELECT domain, key, value, weight, source FROM {MEMORY_SCHEMA}.preferences "
                f"WHERE user_id = $1 AND domain IN ($2, 'general') ORDER BY weight DESC",
                user_id, domain,
            )
        elif domain:
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


# ── Context Anchors ──────────────────────────────────────────

async def upsert_context_anchor(user_id: str, domain: str, anchor_type: str,
                                entities: list, context_data: dict,
                                importance: float = 0.5) -> int:
    """Create or update a context anchor for a user+domain pair."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"INSERT INTO {MEMORY_SCHEMA}.context_anchors "
            f"(user_id, domain, anchor_type, entities, context_data, importance) "
            f"VALUES ($1, $2, $3, $4, $5, $6) "
            f"ON CONFLICT (user_id, domain) DO UPDATE SET "
            f"anchor_type = $3, entities = $4, context_data = $5, "
            f"importance = $6, updated_at = NOW(), last_accessed = NOW() "
            f"RETURNING id",
            user_id, domain, anchor_type,
            json.dumps(entities, ensure_ascii=False),
            json.dumps(context_data, ensure_ascii=False),
            importance,
        )
    return row["id"]


async def get_context_anchors(user_id: str, domain: str | None = None) -> list[dict]:
    """Retrieve context anchors for a user, optionally filtered by domain."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        if domain:
            rows = await conn.fetch(
                f"SELECT id, user_id, domain, anchor_type, entities, context_data, importance, "
                f"created_at, updated_at, last_accessed "
                f"FROM {MEMORY_SCHEMA}.context_anchors "
                f"WHERE user_id = $1 AND domain = $2 "
                f"ORDER BY importance DESC",
                user_id, domain,
            )
        else:
            rows = await conn.fetch(
                f"SELECT id, user_id, domain, anchor_type, entities, context_data, importance, "
                f"created_at, updated_at, last_accessed "
                f"FROM {MEMORY_SCHEMA}.context_anchors "
                f"WHERE user_id = $1 "
                f"ORDER BY importance DESC",
                user_id,
            )
        # Mark as accessed
        if rows:
            anchor_ids = [r["id"] for r in rows]
            await conn.execute(
                f"UPDATE {MEMORY_SCHEMA}.context_anchors "
                f"SET last_accessed = NOW() WHERE id = ANY($1)",
                anchor_ids,
            )
    return [
        {
            "id": r["id"],
            "user_id": r["user_id"],
            "domain": r["domain"],
            "anchor_type": r["anchor_type"],
            "entities": json.loads(r["entities"]) if isinstance(r["entities"], str) else r["entities"],
            "context_data": json.loads(r["context_data"]) if isinstance(r["context_data"], str) else r["context_data"],
            "importance": r["importance"],
            "created_at": str(r["created_at"]),
            "updated_at": str(r["updated_at"]),
            "last_accessed": str(r["last_accessed"]),
        }
        for r in rows
    ]


async def delete_context_anchor(user_id: str, domain: str) -> bool:
    """Delete a context anchor for a user+domain pair."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            f"DELETE FROM {MEMORY_SCHEMA}.context_anchors "
            f"WHERE user_id = $1 AND domain = $2",
            user_id, domain,
        )
    return result == "DELETE 1"


# ── Decision Context (Phase 9.2.2) ─────────────────────────────

VALID_DECISION_STATUSES = {'draft', 'active', 'evaluating', 'decided', 'archived'}
VALID_TRANSITIONS = {
    'draft': {'active'},
    'active': {'evaluating', 'archived'},
    'evaluating': {'decided', 'active'},
    'decided': {'archived'},
    'archived': set(),
}


def _validate_transition(current: str, target: str) -> None:
    if target not in VALID_DECISION_STATUSES:
        raise ValueError(f"Invalid status: {target}")
    if current not in VALID_DECISION_STATUSES:
        raise ValueError(f"Invalid current status: {current}")
    if target not in VALID_TRANSITIONS.get(current, set()):
        raise ValueError(f"Cannot transition from '{current}' to '{target}'")


async def create_decision(user_id: str, domain: str, decision_type: str,
                          title: str | None = None, status: str = 'active') -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"INSERT INTO {MEMORY_SCHEMA}.decision_context "
            f"(user_id, domain, decision_type, title, status) "
            f"VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at",
            user_id, domain, decision_type, title, status,
        )
    return {"id": str(row["id"]), "status": status, "created_at": str(row["created_at"])}


async def get_decision(decision_id: str) -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"SELECT id, user_id, domain, decision_type, title, status, priority, "
            f"created_at, updated_at, closed_at "
            f"FROM {MEMORY_SCHEMA}.decision_context WHERE id = $1",
            decision_id,
        )
        if row is None:
            return None
        entities = await conn.fetch(
            f"SELECT id, entity_type, entity_value, role, created_at "
            f"FROM {MEMORY_SCHEMA}.decision_entities WHERE decision_id = $1 "
            f"ORDER BY created_at",
            decision_id,
        )
        factors = await conn.fetch(
            f"SELECT id, factor, value, weight, source, created_at "
            f"FROM {MEMORY_SCHEMA}.decision_factors WHERE decision_id = $1 "
            f"ORDER BY created_at",
            decision_id,
        )
    return {
        "id": str(row["id"]),
        "user_id": row["user_id"],
        "domain": row["domain"],
        "decision_type": row["decision_type"],
        "title": row["title"],
        "status": row["status"],
        "priority": row["priority"],
        "created_at": str(row["created_at"]),
        "updated_at": str(row["updated_at"]),
        "closed_at": str(row["closed_at"]) if row["closed_at"] else None,
        "entities": [dict(e) for e in entities],
        "factors": [dict(f) for f in factors],
    }


async def list_decisions(user_id: str, domain: str | None = None,
                         status: str | None = None) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        clauses = ["user_id = $1"]
        params = [user_id]
        idx = 2
        if domain:
            clauses.append(f"domain = ${idx}")
            params.append(domain)
            idx += 1
        if status:
            clauses.append(f"status = ${idx}")
            params.append(status)
            idx += 1
        rows = await conn.fetch(
            f"SELECT id, user_id, domain, decision_type, title, status, priority, "
            f"created_at, updated_at, closed_at "
            f"FROM {MEMORY_SCHEMA}.decision_context "
            f"WHERE {' AND '.join(clauses)} ORDER BY priority DESC, created_at DESC",
            *params,
        )
    return [
        {
            "id": str(r["id"]),
            "user_id": r["user_id"],
            "domain": r["domain"],
            "decision_type": r["decision_type"],
            "title": r["title"],
            "status": r["status"],
            "priority": r["priority"],
            "created_at": str(r["created_at"]),
            "updated_at": str(r["updated_at"]),
            "closed_at": str(r["closed_at"]) if r["closed_at"] else None,
        }
        for r in rows
    ]


async def update_decision_status(decision_id: str, new_status: str) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        current = await conn.fetchrow(
            f"SELECT status FROM {MEMORY_SCHEMA}.decision_context WHERE id = $1",
            decision_id,
        )
        if current is None:
            raise ValueError(f"Decision not found: {decision_id}")
        _validate_transition(current["status"], new_status)
        closed_at = "NOW()" if new_status == "archived" else "NULL"
        row = await conn.fetchrow(
            f"UPDATE {MEMORY_SCHEMA}.decision_context "
            f"SET status = $1, updated_at = NOW(), closed_at = {closed_at} "
            f"WHERE id = $2 RETURNING id, status, updated_at, closed_at",
            new_status, decision_id,
        )
    return {
        "id": str(row["id"]),
        "status": row["status"],
        "updated_at": str(row["updated_at"]),
        "closed_at": str(row["closed_at"]) if row["closed_at"] else None,
    }


async def add_decision_entity(decision_id: str, entity_type: str,
                               entity_value: str, role: str = 'candidate') -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"INSERT INTO {MEMORY_SCHEMA}.decision_entities "
            f"(decision_id, entity_type, entity_value, role) "
            f"VALUES ($1, $2, $3, $4) "
            f"ON CONFLICT (decision_id, entity_type, entity_value, role) DO NOTHING "
            f"RETURNING id, created_at",
            decision_id, entity_type, entity_value, role,
        )
    return {"id": str(row["id"]), "entity_type": entity_type,
            "entity_value": entity_value, "role": role, "created_at": str(row["created_at"])}


async def remove_decision_entity(entity_id: str) -> bool:
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            f"DELETE FROM {MEMORY_SCHEMA}.decision_entities WHERE id = $1",
            entity_id,
        )
    return result == "DELETE 1"


async def add_decision_factor(decision_id: str, factor: str, value: dict,
                               weight: float = 0.5, source: str = 'user') -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"INSERT INTO {MEMORY_SCHEMA}.decision_factors "
            f"(decision_id, factor, value, weight, source) "
            f"VALUES ($1, $2, $3, $4, $5) "
            f"ON CONFLICT (decision_id, factor) DO UPDATE SET "
            f"value = $3, weight = $4, source = $5 "
            f"RETURNING id, created_at",
            decision_id, factor, json.dumps(value, ensure_ascii=False), weight, source,
        )
    return {"id": str(row["id"]), "factor": factor, "weight": weight,
            "source": source, "created_at": str(row["created_at"])}


async def remove_decision_factor(factor_id: str) -> bool:
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            f"DELETE FROM {MEMORY_SCHEMA}.decision_factors WHERE id = $1",
            factor_id,
        )
    return result == "DELETE 1"
