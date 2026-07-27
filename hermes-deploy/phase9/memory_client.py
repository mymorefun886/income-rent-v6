# Hermes Core — Memory Client
# HTTP client to hermes-memory service (Docker DNS).
# v1.5.1 — Added context anchor support.

import httpx
from config import MEMORY_HOST, MEMORY_PORT


class MemoryClient:
    """Talks to hermes-memory API. All memory ops go through this — never direct DB."""

    def __init__(self):
        self.base = f"http://{MEMORY_HOST}:{MEMORY_PORT}"

    async def recall(self, user_id: str, domain: str | None = None, limit: int = 10) -> dict:
        """Recall full user context: profile + preferences + recent events + anchors."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self.base}/memory/recall",
                json={"user_id": user_id, "domain": domain, "limit": limit},
            )
            resp.raise_for_status()
            return resp.json()

    async def store(self, user_id: str, memory_type: str, data: dict) -> dict:
        """Store a memory event, preference, or decision."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self.base}/memory/store",
                json={"user_id": user_id, "type": memory_type, "data": data},
            )
            resp.raise_for_status()
            return resp.json()

    async def search(self, user_id: str, query: str, domain: str | None = None, limit: int = 5) -> list:
        """Semantic search over vector memory."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self.base}/memory/search",
                json={"user_id": user_id, "query": query, "domain": domain, "limit": limit},
            )
            resp.raise_for_status()
            return resp.json().get("results", [])

    async def save_anchor(self, user_id: str, domain: str, anchor_type: str,
                          entities: list, context_data: dict, importance: float = 0.5) -> dict:
        """Upsert a context anchor for long-term decision state."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self.base}/memory/context-anchor",
                json={
                    "user_id": user_id,
                    "domain": domain,
                    "anchor_type": anchor_type,
                    "entities": entities,
                    "context_data": context_data,
                    "importance": importance,
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def get_anchors(self, user_id: str, domain: str | None = None) -> list[dict]:
        """Retrieve context anchors for a user."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self.base}/memory/context-anchors",
                json={"user_id": user_id, "domain": domain},
            )
            resp.raise_for_status()
            return resp.json().get("anchors", [])

    # ── Decision Context (Phase 9.2.2) ─────────────────────────

    async def create_decision(self, user_id: str, domain: str = "education",
                               decision_type: str = "secondary_school_selection",
                               title: str | None = None) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self.base}/memory/decision/create",
                json={"user_id": user_id, "domain": domain,
                      "decision_type": decision_type, "title": title},
            )
            resp.raise_for_status()
            return resp.json()

    async def get_decision(self, decision_id: str) -> dict | None:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{self.base}/memory/decision/{decision_id}")
            resp.raise_for_status()
            data = resp.json()
            return None if "error" in data else data

    async def list_decisions(self, user_id: str, domain: str | None = None,
                              status: str | None = None) -> list[dict]:
        async with httpx.AsyncClient(timeout=10) as client:
            params = {}
            if domain:
                params["domain"] = domain
            if status:
                params["status"] = status
            resp = await client.get(
                f"{self.base}/memory/decisions/{user_id}", params=params or None,
            )
            resp.raise_for_status()
            return resp.json().get("decisions", [])

    async def add_decision_entity(self, decision_id: str, entity_type: str,
                                   entity_value: str, role: str = "candidate") -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self.base}/memory/decision/{decision_id}/entity",
                json={"entity_type": entity_type, "entity_value": entity_value, "role": role},
            )
            resp.raise_for_status()
            return resp.json()

    async def add_decision_factor(self, decision_id: str, factor: str,
                                   value: dict, weight: float = 0.5,
                                   source: str = "user") -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self.base}/memory/decision/{decision_id}/factor",
                json={"factor": factor, "value": value, "weight": weight, "source": source},
            )
            resp.raise_for_status()
            return resp.json()

    async def update_decision_status(self, decision_id: str, status: str) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.patch(
                f"{self.base}/memory/decision/{decision_id}/status",
                json={"status": status},
            )
            resp.raise_for_status()
            return resp.json()
