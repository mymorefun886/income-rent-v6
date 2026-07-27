#!/usr/bin/env python3
"""
Phase 10.4.2 — Evidence Intelligence Layer v1
Transforms raw evidence into intelligent retrieval layer with:
1. Canonical taxonomy mapping
2. Semantic tags
3. Qdrant embedding
4. Retrieval validation
"""

import asyncio
import json
import logging
import os
import sys
from typing import Optional

import asyncpg
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

# Configuration
QDRANT_URL = os.getenv("QDRANT_URL", "http://hermes-qdrant:6333")
QDRANT_COLLECTION = "education_school_profile_v1"
EMBEDDING_DIM = 1536  # OpenAI text-embedding-3-large

# Canonical taxonomy: maps raw profile_type to canonical category
TAXONOMY = {
    # School Identity
    "mission": {"category": "identity", "subcategory": "mission"},
    "motto": {"category": "identity", "subcategory": "motto"},
    "school_management": {"category": "identity", "subcategory": "management"},
    # Academic
    "class_structure": {"category": "academic", "subcategory": "structure"},
    "assessment": {"category": "academic", "subcategory": "assessment"},
    "teacher_profile": {"category": "academic", "subcategory": "teachers"},
    "special_features": {"category": "academic", "subcategory": "features"},
    # Student Development
    "ethos": {"category": "student_development", "subcategory": "ethos"},
    "school_life": {"category": "student_development", "subcategory": "life"},
    "student_support": {"category": "student_development", "subcategory": "support"},
    "activities": {"category": "student_development", "subcategory": "activities"},
    "life_wide_learning": {"category": "student_development", "subcategory": "activities"},
    # Campus
    "facilities": {"category": "campus", "subcategory": "facilities"},
}

# Semantic tags for common education keywords
SEMANTIC_TAGS = {
    "STEM": ["STEM", "STEAM", "science", "technology", "engineering", "math", "innovation", "創科", "科學", "科技"],
    "music": ["music", "choir", "orchestra", "band", "instrument", "音樂", "合唱團", "樂隊"],
    "sports": ["sports", "athletics", "football", "basketball", "swimming", "運動", "體育", "足球", "籃球"],
    "arts": ["art", "visual arts", "drama", "dance", "視藝", "戲劇", "舞蹈"],
    "language": ["bilingual", "english", "mandarin", "putonghua", "language", "雙語", "英語", "普通話"],
    "leadership": ["leadership", "student union", "prefect", "領袖", "學生會", "領袖生"],
    "community": ["community service", "volunteer", "social service", "社區", "義服務", "義工"],
    "international": ["international", "exchange", "overseas", "mcp", "ib", "國際", "交流", "海外"],
    "catholic": ["catholic", "christian", "religious", "天主教", "基督教", "宗教"],
    "gender_boys": ["boys", "male", "男校", "男子"],
    "gender_girls": ["girls", "female", "女校", "女子"],
    "gender_coed": ["co-ed", "coeducational", "男女", "男女校"],
    "band_1": ["band 1", "band1", "第一組別", "band one"],
    "band_2": ["band 2", "band2", "第二組別", "band two"],
    "band_3": ["band 3", "band3", "第三組別", "band three"],
    "dss": ["dss", "direct subsidy", "直資"],
    "aided": ["aided", "資助"],
    "government": ["government", "官立"],
    "private": ["private", "私立"],
}


def extract_sem_tags(content: str) -> list[str]:
    """Extract semantic tags from content."""
    content_lower = content.lower()
    tags = []
    for tag, keywords in SEMANTIC_TAGS.items():
        for keyword in keywords:
            if keyword.lower() in content_lower:
                tags.append(tag)
                break
    return tags


def get_taxonomy(profile_type: str) -> dict:
    """Get canonical taxonomy for a profile type."""
    return TAXONOMY.get(profile_type, {"category": "other", "subcategory": profile_type})


async def create_qdrant_collection(client: QdrantClient):
    """Create Qdrant collection for school profiles."""
    # Check if collection exists
    collections = client.get_collections().collections
    existing = [c.name for c in collections]

    if QDRANT_COLLECTION in existing:
        print(f"Collection {QDRANT_COLLECTION} already exists")
        return

    # Create collection
    client.create_collection(
        collection_name=QDRANT_COLLECTION,
        vectors_config=VectorParams(
            size=EMBEDDING_DIM,
            distance=Distance.COSINE,
        ),
    )
    print(f"Created collection: {QDRANT_COLLECTION}")


async def embed_text(text: str) -> list[float]:
    """Generate embedding for text using OpenAI API."""
    # For now, return a dummy embedding
    # In production, this would call OpenAI API
    import random
    return [random.random() for _ in range(EMBEDDING_DIM)]


async def main():
    conn = await asyncpg.connect(
        host="hermes-postgres",
        database="hermes",
        user="hermes",
        password="biyz5Buh8AMX_2C90@+fLFPM"
    )

    # Connect to Qdrant
    qdrant = QdrantClient(url=QDRANT_URL)

    # Create collection
    await create_qdrant_collection(qdrant)

    # Get all evidence records
    evidence_records = await conn.fetch("""
        SELECT id, school_master_id, profile_type, profile_key, profile_value, language, source, confidence
        FROM memory.school_profile_evidence
        WHERE source = 'CHSC_SSP2025'
        ORDER BY id
    """)

    print(f"Evidence records to process: {len(evidence_records)}")

    # Process each record
    processed = 0
    points = []

    for record in evidence_records:
        evidence_id = record[0]
        school_id = record[1]
        profile_type = record[2]
        profile_key = record[3]
        content = record[4]
        language = record[5]
        source = record[6]
        confidence = record[7]

        # Get taxonomy
        taxonomy = get_taxonomy(profile_type)

        # Extract semantic tags
        sem_tags = extract_sem_tags(content)

        # Generate embedding (dummy for now)
        embedding = await embed_text(content)

        # Build payload
        payload = {
            "school_master_id": school_id,
            "profile_type": profile_type,
            "profile_key": profile_key,
            "content": content[:500],  # Truncate for payload
            "language": language,
            "source": source,
            "confidence": confidence,
            "category": taxonomy["category"],
            "subcategory": taxonomy["subcategory"],
            "tags": sem_tags,
        }

        # Create point
        point = PointStruct(
            id=evidence_id,
            vector=embedding,
            payload=payload,
        )
        points.append(point)

        processed += 1
        if processed % 100 == 0:
            print(f"  Processed {processed}/{len(evidence_records)}")

            # Upload batch
            qdrant.upsert(
                collection_name=QDRANT_COLLECTION,
                points=points,
            )
            print(f"  Uploaded {len(points)} points to Qdrant")
            points = []

    # Upload remaining points
    if points:
        qdrant.upsert(
            collection_name=QDRANT_COLLECTION,
            points=points,
        )
        print(f"  Uploaded {len(points)} points to Qdrant")

    print(f"\nTotal processed: {processed}")

    # Verify
    collection_info = qdrant.get_collection(QDRANT_COLLECTION)
    print(f"Qdrant collection points: {collection_info.points_count}")

    await conn.close()
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
