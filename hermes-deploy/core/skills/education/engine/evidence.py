# Education Engine — Evidence Retrieval
# Queries Knowledge API for school evidence (all recommendations must have reasons)

import httpx


async def retrieve_evidence(
    domain: str,
    schools: list[dict],
    family=None,
    child=None,
    knowledge_url: str = "http://hermes-knowledge:8000",
) -> dict[str, list[dict]]:
    """
    Query knowledge service for evidence on each school.
    Returns {school_name: [evidence_dict, ...]} map.
    """
    evidence_map: dict[str, list[dict]] = {}

    for school in schools:
        name = school.get("name", "")
        if not name:
            continue

        # Build targeted query from school attributes
        search_terms = [name]
        if school.get("district"):
            search_terms.append(school["district"])
        if school.get("band"):
            search_terms.append(school["band"])
        if school.get("type"):
            search_terms.append(school["type"])
        query = " ".join(search_terms)

        # Query knowledge service
        filters = _build_filters(school, family, child)
        try:
            result = await _search_knowledge(domain, query, filters, limit=5, base_url=knowledge_url)
            evidence_map[name] = _parse_evidence(result)
        except Exception:
            evidence_map[name] = []

    return evidence_map


def _build_filters(school: dict, family, child) -> dict:
    """Build metadata filters for knowledge search."""
    filters = {}
    if school.get("district"):
        filters["district"] = school["district"]
    if school.get("type"):
        filters["school_type"] = school["type"]
    if school.get("band"):
        filters["band"] = school["band"]
    return filters


async def _search_knowledge(domain: str, query: str, filters: dict, limit: int, base_url: str) -> dict:
    """Call hermes-knowledge API."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{base_url}/knowledge/search",
            json={"domain": domain, "query": query, "filters": filters, "limit": limit},
        )
        resp.raise_for_status()
        return resp.json()


def _parse_evidence(result: dict) -> list[dict]:
    """Parse knowledge service response into evidence list."""
    items = []
    for doc in result.get("documents", []):
        items.append({
            "source": doc.get("source", "knowledge_base"),
            "title": doc.get("title", ""),
            "snippet": (doc.get("content", "") or doc.get("snippet", ""))[:300],
            "score": doc.get("score", 0.0),
            "metadata": doc.get("metadata", {}),
        })
    return items


def format_evidence_for_response(evidence_map: dict[str, list[dict]]) -> str:
    """Render evidence into a readable text block for the recommendation."""
    lines = []
    for school_name, items in evidence_map.items():
        if not items:
            continue
        lines.append(f"\n{school_name}:")
        for i, item in enumerate(items[:3], 1):
            source = item.get("source", "unknown")
            snippet = item.get("snippet", "")
            lines.append(f"  [{i}] ({source}) {snippet}")
    return "\n".join(lines)
