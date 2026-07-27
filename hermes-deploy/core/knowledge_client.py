# Hermes Core — Knowledge Client
# HTTP client to hermes-knowledge service (Docker DNS)

import httpx
from config import QDRANT_HOST, QDRANT_PORT  # unused directly; knowledge has its own host


class KnowledgeClient:
    """Talks to hermes-knowledge API for domain evidence retrieval."""

    def __init__(self, base_url: str = "http://hermes-knowledge:8000"):
        self.base = base_url

    async def search(self, domain: str, query: str, filters: dict | None = None, limit: int = 10) -> dict:
        """Search a domain knowledge collection. Returns KnowledgeResult-compatible dict."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{self.base}/knowledge/search",
                json={"domain": domain, "query": query, "filters": filters or {}, "limit": limit},
            )
            resp.raise_for_status()
            return resp.json()

    async def upsert(self, domain: str, point_id: str, vector: list[float], payload: dict) -> dict:
        """Insert a document into a knowledge collection."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{self.base}/knowledge/upsert",
                json={"domain": domain, "point_id": point_id, "vector": vector, "payload": payload},
            )
            resp.raise_for_status()
            return resp.json()
