# Hermes Knowledge — Qdrant Store
# Domain-isolated vector search. Never cross-contaminates domains.

import logging

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, Filter, FieldCondition, MatchValue

from config import QDRANT_URL, VECTOR_SIZE, collection_for
from models import Evidence, KnowledgeResult

logger = logging.getLogger("hermes.knowledge")

client = QdrantClient(url=QDRANT_URL)

KNOWN_COLLECTIONS = {
    "knowledge_education_v1",
    "knowledge_commerce_v1",
    "knowledge_investment_v1",
    "knowledge_personal_v1",
    "knowledge_general_v1",
}


def ensure_collections() -> None:
    """Create domain collections if they don't exist."""
    existing = {c.name for c in client.get_collections().collections}
    for name in sorted(KNOWN_COLLECTIONS):
        if name not in existing:
            client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
            )
            logger.info("Created collection: %s", name)


def search(domain: str, query_text: str, filters: dict | None = None, limit: int = 10) -> KnowledgeResult:
    """Search a domain collection with optional metadata filters.

    Currently uses Qdrant scroll with filters (metadata-level retrieval).
    Full semantic search will be enabled when the embedding model is wired in Phase 5.5.
    """
    collection = collection_for(domain)

    # Build Qdrant filter from domain + caller-provided filters
    must_conditions = []

    if filters:
        for key, value in filters.items():
            must_conditions.append(FieldCondition(key=key, match=MatchValue(value=value)))

    qdrant_filter = Filter(must=must_conditions) if must_conditions else None

    # Scroll points matching the filter (metadata-only for now)
    records, _next_offset = client.scroll(
        collection_name=collection,
        scroll_filter=qdrant_filter,
        limit=limit,
        with_payload=True,
        with_vectors=False,
    )

    documents = []
    for point in records:
        payload = point.payload or {}
        documents.append(Evidence(
            content=payload.get("content", payload.get("text", "")),
            source=payload.get("source", payload.get("url", "")),
            score=0.0,  # scroll doesn't return scores; search() will when embeddings are wired
            metadata={k: v for k, v in payload.items() if k not in ("content", "text", "source", "url")},
        ))

    confidence = _compute_confidence(documents)

    return KnowledgeResult(
        domain=domain,
        documents=documents,
        confidence=confidence,
    )


def _compute_confidence(documents: list[Evidence]) -> float:
    if not documents:
        return 0.0
    scores = [d.score for d in documents if d.score > 0]
    if not scores:
        return 0.3  # matched but no scores — low confidence
    return round(sum(scores) / len(scores), 4)


def upsert(domain: str, point_id: str, vector: list[float], payload: dict) -> None:
    """Insert or update a vector point in a domain collection."""
    collection = collection_for(domain)
    client.upsert(
        collection_name=collection,
        points=[{
            "id": point_id,
            "vector": vector,
            "payload": payload,
        }],
    )
