#!/usr/bin/env python3
"""
Layer 4: CHSC Secondary School Profile Ingestion
Ingests school profiles into school_profile_evidence table with proper evidence splitting.
"""

import asyncio
import json
import sys

import asyncpg

# Evidence type mapping from profile_data fields
EVIDENCE_TYPES = {
    "mission": "mission",
    "special_features": "special_features",
    "ethos": "ethos",
    "facilities": "facilities",
    "activities": "life_wide_learning",
    "assessment": "assessment",
    "teacher_info": "teacher_profile",
    "class_structure": "class_structure",
    "school_info": "school_info",
}

# Source information
SOURCE = "CHSC_SSP2025"
SOURCE_URL = "https://www.chsc.hk/ssp2025/"
LANGUAGE = "zh-HK"


async def ingest_profiles():
    conn = await asyncpg.connect(
        host="hermes-postgres",
        database="hermes",
        user="hermes",
        password="biyz5Buh8AMX_2C90@+fLFPM"
    )

    # Get confirmed mappings (434 schools)
    mappings = await conn.fetch("""
        SELECT m.source_school_id, m.school_master_id, m.confidence
        FROM memory.school_entity_mapping m
        WHERE m.source_system = 'CHSC'
        AND m.confidence >= 0.90
    """)

    print(f"Confirmed mappings: {len(mappings)}")

    # Get CHSC schools with profile data
    schools = await conn.fetch("""
        SELECT school_id, canonical_name, school_name_zh, profile_data
        FROM memory.school_entity
        WHERE source_name = 'chsc_secondary_csv'
        AND profile_data IS NOT NULL
    """)

    print(f"Schools with profile data: {len(schools)}")

    # Build mapping lookup
    mapping_lookup = {m[0]: (m[1], m[2]) for m in mappings}

    # Ingest profiles
    inserted = 0
    skipped = 0

    for school in schools:
        chsc_id = school[0]
        master_id, confidence = mapping_lookup.get(chsc_id, (None, None))

        if not master_id:
            skipped += 1
            continue

        profile_data = json.loads(school[3]) if school[3] else {}

        # Split profile into separate evidence records
        for field_key, evidence_type in EVIDENCE_TYPES.items():
            content = profile_data.get(field_key)
            if not content or not isinstance(content, str):
                continue

            # Skip very short content
            if len(content.strip()) < 10:
                continue

            # Insert evidence
            await conn.execute("""
                INSERT INTO memory.school_profile_evidence
                (school_master_id, profile_type, profile_key, profile_value, language, source, source_version, confidence)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT DO NOTHING
            """,
                master_id,
                evidence_type,
                field_key,
                content.strip(),
                LANGUAGE,
                SOURCE,
                SOURCE,
                confidence
            )
            inserted += 1

    print(f"\nEvidence records inserted: {inserted}")
    print(f"Schools skipped (no mapping): {skipped}")

    # Verify
    total_evidence = await conn.fetchval("SELECT COUNT(*) FROM memory.school_profile_evidence WHERE source = %s", SOURCE)
    schools_with_evidence = await conn.fetchval("""
        SELECT COUNT(DISTINCT school_master_id)
        FROM memory.school_profile_evidence
        WHERE source = %s
    """, SOURCE)

    print(f"\nTotal evidence records: {total_evidence}")
    print(f"Schools with evidence: {schools_with_evidence}")

    # Sample evidence
    sample = await conn.fetch("""
        SELECT profile_type, profile_key, LEFT(content, 100) as content_preview
        FROM memory.school_profile_evidence
        WHERE source = %s
        LIMIT 10
    """, SOURCE)

    print("\nSample evidence:")
    for s in sample:
        print(f"  {s[0]} / {s[1]}: {s[2]}...")

    await conn.close()
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(ingest_profiles())
