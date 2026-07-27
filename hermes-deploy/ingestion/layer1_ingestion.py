#!/usr/bin/env python3
"""
Layer 1 Ingestion: EDB School Location & Data
Reads SCH_LOC_EDB.json → school_entity_master + school_alias
"""

import asyncio
import json
import logging
import os
import re

import asyncpg

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# DB connection
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "hermes-postgres")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.getenv("POSTGRES_DB", "hermes")
POSTGRES_USER = os.getenv("POSTGRES_USER", "hermes")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")

# Category → school_level mapping
CATEGORY_TO_LEVEL = {
    # Kindergarten
    "Kindergartens": "kindergarten",
    "Kindergarten-cum-child Care Centres": "kindergarten",
    # Primary
    "Aided Primary Schools": "primary",
    "Government Primary Schools": "primary",
    "Private Primary Schools": "primary",
    "International Schools (Primary)": "primary",
    "Direct Subsidy Scheme Primary Schools": "primary",
    "English Schools Foundation (Primary)": "primary",
    # Secondary
    "Aided Secondary Schools": "secondary",
    "Government Secondary Schools": "secondary",
    "Private Secondary Schools (Day/Evening)": "secondary",
    "International Schools (Secondary)": "secondary",
    "Direct Subsidy Scheme Secondary Schools": "secondary",
    "English Schools Foundation (Secondary)": "secondary",
    "Caput Secondary Schools": "secondary",
    # Special
    "Aided Special Schools": "special",
}

# Category → finance_type mapping
CATEGORY_TO_FINANCE = {
    "Aided Primary Schools": "Aided",
    "Aided Secondary Schools": "Aided",
    "Aided Special Schools": "Aided",
    "Government Primary Schools": "Government",
    "Government Secondary Schools": "Government",
    "Private Primary Schools": "Private",
    "Private Secondary Schools (Day/Evening)": "Private",
    "Direct Subsidy Scheme Primary Schools": "DSS",
    "Direct Subsidy Scheme Secondary Schools": "DSS",
    "International Schools (Primary)": "International",
    "International Schools (Secondary)": "International",
    "English Schools Foundation (Primary)": "ESF",
    "English Schools Foundation (Secondary)": "ESF",
    "Caput Secondary Schools": "Caput",
}


def normalize_edb_school_no(raw) -> str:
    """Normalize EDB school number to string."""
    if raw is None:
        return ""
    # Convert to string and strip
    s = str(raw).strip()
    # Remove .0 suffix if present (from float conversion)
    if s.endswith(".0"):
        s = s[:-2]
    return s


def extract_district_from_address(address_en: str) -> str:
    """Extract district from English address (heuristic)."""
    if not address_en:
        return ""
    # Common districts in addresses
    district_patterns = [
        ("KOWLOON CITY", "Kowloon City"),
        ("YAU TSIM MONG", "Yau Tsim Mong"),
        ("SHAM SHUI PO", "Sham Shui Po"),
        ("WONG TAI SIN", "Wong Tai Sin"),
        ("KWUN TONG", "Kwun Tong"),
        ("SAI KUNG", "Sai Kung"),
        ("SHA TIN", "Sha Tin"),
        ("TSUEN WAN", "Tsuen Wan"),
        ("TUEN MUN", "Tuen Mun"),
        ("YUEN LONG", "Yuen Long"),
        ("KWAI TSING", "Kwai Tsing"),
        ("ISLANDS", "Islands"),
        ("NORTH", "North"),
        ("TAI PO", "Tai Po"),
        ("WAN CHAI", "Wan Chai"),
        ("CENTRAL AND WESTERN", "Central and Western"),
        ("EASTERN", "Eastern"),
        ("SOUTHERN", "Southern"),
    ]
    addr_upper = address_en.upper()
    for pattern, district in district_patterns:
        if pattern in addr_upper:
            return district
    return ""


def generate_aliases(name_en: str, name_zh: str) -> list[dict]:
    """Generate aliases from school names."""
    aliases = []

    if name_en:
        # Full English name
        aliases.append({
            "alias": name_en.strip(),
            "alias_normalized": name_en.strip().upper(),
            "locale": "en",
            "alias_type": "official",
            "confidence": 1.0,
        })
        # Short form (remove "School", "College", etc.)
        short_en = re.sub(r"\b(School|College|Kindergarten|Primary|Secondary|Memorial|Memorial)\b", "", name_en, flags=re.IGNORECASE)
        short_en = re.sub(r"\s+", " ", short_en).strip()
        if short_en and short_en != name_en.strip():
            aliases.append({
                "alias": short_en,
                "alias_normalized": short_en.upper(),
                "locale": "en",
                "alias_type": "short",
                "confidence": 0.9,
            })

    if name_zh:
        # Full Chinese name
        aliases.append({
            "alias": name_zh.strip(),
            "alias_normalized": name_zh.strip(),
            "locale": "zh-HK",
            "alias_type": "official",
            "confidence": 1.0,
        })
        # Short form (remove common suffixes)
        short_zh = re.sub(r"(學校|書院|小學|中學|幼稚園|幼兒園|紀念)$", "", name_zh)
        if short_zh and short_zh != name_zh.strip():
            aliases.append({
                "alias": short_zh,
                "alias_normalized": short_zh,
                "locale": "zh-HK",
                "alias_type": "short",
                "confidence": 0.9,
            })

    return aliases


async def ingest_edb(json_path: str):
    """Ingest EDB JSON into school_entity_master + school_alias."""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    logger.info(f"Loaded {len(data)} schools from {json_path}")

    # Connect to PostgreSQL
    conn = await asyncpg.connect(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        database=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
    )

    # Upsert counter
    inserted = 0
    updated = 0
    failed = 0
    alias_count = 0

    for school in data:
        try:
            # Extract fields
            school_no = normalize_edb_school_no(school.get("SCHOOL NO."))
            name_en = school.get("ENGLISH NAME", "").strip()
            name_zh = school.get("中文名稱", "").strip()
            address_en = school.get("ENGLISH ADDRESS", "").strip()
            address_zh = school.get("中文地址", "").strip()
            latitude = school.get("LATITUDE")
            longitude = school.get("LONGITUDE")
            category_en = school.get("ENGLISH CATEGORY", "")
            category_zh = school.get("中文類別", "")

            # Map category to level
            school_level = CATEGORY_TO_LEVEL.get(category_en, "unknown")
            finance_type = CATEGORY_TO_FINANCE.get(category_en, "")

            # Extract district from address
            district = extract_district_from_address(address_en)

            # Upsert school_entity_master
            result = await conn.fetchrow("""
                INSERT INTO memory.school_entity_master (
                    edb_school_no, school_name_en, school_name_zh,
                    school_level, district, address_en, address_zh,
                    latitude, longitude, finance_type,
                    source, source_version
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (edb_school_no) DO UPDATE SET
                    school_name_en = EXCLUDED.school_name_en,
                    school_name_zh = EXCLUDED.school_name_zh,
                    school_level = EXCLUDED.school_level,
                    district = EXCLUDED.district,
                    address_en = EXCLUDED.address_en,
                    address_zh = EXCLUDED.address_zh,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    finance_type = EXCLUDED.finance_type,
                    updated_at = NOW()
                RETURNING id, (xmax = 0) AS is_insert
            """,
                school_no, name_en, name_zh, school_level, district,
                address_en, address_zh, latitude, longitude, finance_type,
                "EDB", "2026-07-01"
            )

            if result:
                master_id = result["id"]
                if result["is_insert"]:
                    inserted += 1
                else:
                    updated += 1

                # Generate and insert aliases
                aliases = generate_aliases(name_en, name_zh)
                for alias in aliases:
                    await conn.execute("""
                        INSERT INTO memory.school_alias (
                            school_id, alias, alias_normalized, locale, alias_type, confidence, source
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT DO NOTHING
                    """,
                        master_id, alias["alias"], alias["alias_normalized"],
                        alias["locale"], alias["alias_type"], alias["confidence"],
                        "EDB"
                    )
                    alias_count += 1

        except Exception as e:
            failed += 1
            if failed <= 5:
                logger.warning(f"Failed to ingest school: {e}")

    await conn.close()

    logger.info(f"=== Layer 1 Ingestion Complete ===")
    logger.info(f"Inserted: {inserted}")
    logger.info(f"Updated: {updated}")
    logger.info(f"Failed: {failed}")
    logger.info(f"Aliases created: {alias_count}")

    return {"inserted": inserted, "updated": updated, "failed": failed, "aliases": alias_count}


if __name__ == "__main__":
    asyncio.run(ingest_edb("/tmp/SCH_LOC_EDB.json"))
