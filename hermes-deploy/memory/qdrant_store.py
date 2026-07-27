# Hermes Memory Service — Qdrant Vector Store
# Semantic search over memory_v1 collection

import httpx
from config import QDRANT_URL


async def search_vectors(user_id: str, query_vector: list[float], domain: str | None = None, limit: int = 5) -> list[dict]:
    """Search Qdrant for semantically similar memory vectors."""
    must_filter = [{"key": "user_id", "match": {"value": user_id}}]
    if domain:
        must_filter.append({"key": "domain", "match": {"value": domain}})

    payload = {
        "vector": query_vector,
        "limit": limit,
        "with_payload": True,
        "filter": {"must": must_filter},
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{QDRANT_URL}/collections/memory_v1/points/search",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json().get("result", [])


async def upsert_vector(point_id: str, vector: list[float], payload: dict) -> None:
    """Insert or update a memory vector."""
    body = {
        "points": [
            {"id": point_id, "vector": vector, "payload": payload}
        ]
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.put(
            f"{QDRANT_URL}/collections/memory_v1/points",
            json=body,
        )
        resp.raise_for_status()
