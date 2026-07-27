# Hermes Core — Memory Client
# HTTP client to hermes-memory service (Docker DNS)

import httpx
from config import MEMORY_HOST, MEMORY_PORT


class MemoryClient:
    """Talks to hermes-memory API. All memory ops go through this — never direct DB."""

    def __init__(self):
        self.base = f"http://{MEMORY_HOST}:{MEMORY_PORT}"

    async def recall(self, user_id: str, domain: str | None = None, limit: int = 10) -> dict:
        """Recall user context: profile + preferences + recent events."""
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
