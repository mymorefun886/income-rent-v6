#!/usr/bin/env python3
"""
Phase 10.4.2 — Retrieval Validation Tests
Tests the Evidence Intelligence Layer with sample queries.
"""

import asyncio
import json
import os
import sys

from qdrant_client import QdrantClient

QDRANT_URL = os.getenv("QDRANT_URL", "http://hermes-qdrant:6333")
QDRANT_COLLECTION = "education_school_profile_v1"


def embed_query(text: str) -> list[float]:
    """Generate embedding for query (dummy for now)."""
    import random
    return [random.random() for _ in range(1536)]


def search(qdrant: QdrantClient, query: str, filters: dict = None, limit: int = 5):
    """Search Qdrant with optional filters."""
    vector = embed_search(query)

    from qdrant_client.models import Filter, FieldCondition, MatchValue

    must_filters = []
    if filters:
        for key, value in filters.items():
            must_filters.append(
                FieldCondition(key=key, match=MatchValue(value=value))
            )

    query_filter = Filter(must=must_filters) if must_filters else None

    results = qdrant.query_points(
        collection_name=QDRANT_COLLECTION,
        query=vector,
        query_filter=query_filter,
        limit=limit,
        with_payload=True,
    )
    return results.points


def embed_search(text: str) -> list[float]:
    """Generate embedding for search query."""
    import random
    return [random.random() for _ in range(1536)]


def main():
    qdrant = QdrantClient(url=QDRANT_URL)

    print("=" * 80)
    print("Phase 10.4.2 — Retrieval Validation Tests")
    print("=" * 80)

    # Test Case 1: STEM schools
    print("\n[Test 1] Query: 葵青區 STEM 特色中學")
    print("-" * 40)
    results = search(qdrant, "STEM education innovation technology", limit=5)
    for i, r in enumerate(results, 1):
        payload = r.payload
        print(f"  {i}. {payload.get('school_master_id')} - {payload.get('profile_type')}")
        print(f"     Tags: {payload.get('tags', [])}")
        print(f"     Content: {payload.get('content', '')[:80]}...")

    # Test Case 2: Catholic girls school with music
    print("\n[Test 2] Query: Catholic girls school with music activities")
    print("-" * 40)
    results = search(qdrant, "catholic girls music choir orchestra", limit=5)
    for i, r in enumerate(results, 1):
        payload = r.payload
        print(f"  {i}. {payload.get('school_master_id')} - {payload.get('profile_type')}")
        print(f"     Tags: {payload.get('tags', [])}")
        print(f"     Content: {payload.get('content', '')[:80]}...")

    # Test Case 3: Student support
    print("\n[Test 3] Query: Schools with strong student support")
    print("-" * 40)
    results = search(qdrant, "student support ethos school life", limit=5)
    for i, r in enumerate(results, 1):
        payload = r.payload
        print(f"  {i}. {payload.get('school_master_id')} - {payload.get('profile_type')}")
        print(f"     Tags: {payload.get('tags', [])}")
        print(f"     Content: {payload.get('content', '')[:80]}...")

    # Test Case 4: Filter by tag
    print("\n[Test 4] Query: Filter by STEM tag")
    print("-" * 40)
    results = search(qdrant, "education", filters={"tags": "STEM"}, limit=5)
    for i, r in enumerate(results, 1):
        payload = r.payload
        print(f"  {i}. {payload.get('school_master_id')} - {payload.get('profile_type')}")
        print(f"     Tags: {payload.get('tags', [])}")
        print(f"     Content: {payload.get('content', '')[:80]}...")

    # Test Case 5: English query
    print("\n[Test 5] Query: English - schools with music activities")
    print("-" * 40)
    results = search(qdrant, "music activities", filters={"language": "en"}, limit=5)
    for i, r in enumerate(results, 1):
        payload = r.payload
        print(f"  {i}. {payload.get('school_master_id')} - {payload.get('profile_type')}")
        print(f"     Language: {payload.get('language')}")
        print(f"     Tags: {payload.get('tags', [])}")
        print(f"     Content: {payload.get('content', '')[:80]}...")

    print("\n" + "=" * 80)
    print("Tests complete!")
    print("=" * 80)


if __name__ == "__main__":
    main()
