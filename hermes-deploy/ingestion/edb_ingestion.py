# Hermes Ingestion — EDB School Master Registry Ingestion
# Parses EDB JSON from data.gov.hk → school_entity_master + school_entity_mapping
#
# EDB JSON structure (39 fields):
#   {
#     "school_no": "123456",
#     "school_name_eng": "ABC School",
#     "school_name_chin": "ABC 學校",
#     "address_eng": "123 Road",
#     "address_chin": "道路123號",
#     "latitude": 22.3193,
#     "longitude": 114.1694,
#     "phone": "12345678",
#     "fax": "12345679",
#     "email": "info@abc.edu.hk",
#     "website": "http://www.abc.edu.hk",
#     "school_level": "Secondary",
#     "finance_type": "Aided",
#     "religion": "Christianity",
#     ...
#   }
#
# EDB data does NOT contain fee/tuition data — confirmed via data spec PDF.
# EDB is School Master Registry, not academic source.

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional

import psycopg2
import psycopg2.extras

from config import (
    POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB,
    POSTGRES_USER, POSTGRES_PASSWORD,
)

logger = logging.getLogger("hermes.ingestion.edb")

# ── EDB Column Mapping ──────────────────────────────────────────────────
# Maps EDB JSON field names → school_entity_master column names
EDB_COLUMN_MAP = {
    "school_no": "edb_school_no",
    "school_name_eng": "school_name_en",
    "school_name_chin": "school_name_zh",
    "address_eng": "address_en",
    "address_chin": "address_zh",
    "latitude": "latitude",
    "longitude": "longitude",
    "phone": "phone",
    "fax": "fax",
    "email": "email",
    "website": "website",
    "school_level": "school_level",
    "finance_type": "finance_type",
    "religion": "religion",
    "district": "district",
    "district_code": "district_code",
}

# ── Normalization Maps ──────────────────────────────────────────────────

SCHOOL_LEVEL_MAP = {
    # Chinese
    "幼稚園": "kindergarten",
    "小學": "primary",
    "中學": "secondary",
    "特殊教育": "special",
    "幼兒園": "kindergarten",
    "小學暨初中": "primary_secondary",
    "中學暨小學": "primary_secondary",
    # English
    "Kindergarten": "kindergarten",
    "Primary": "primary",
    "Secondary": "secondary",
    "Special": "special",
    "Primary and Secondary": "primary_secondary",
    # EDB API variants
    "KG": "kindergarten",
    "PR": "primary",
    "SEC": "secondary",
    "SP": "special",
}

FINANCE_TYPE_MAP = {
    # Chinese
    "官立": "Government",
    "資助": "Aided",
    "直資": "DSS",
    "私立": "Private",
    "國際": "International",
    "英基": "ESF",
    # English
    "Government": "Government",
    "Aided": "Aided",
    "Caput": "Caput",
    "Direct Subsidy Scheme": "DSS",
    "DSS": "DSS",
    "Private": "Private",
    "International": "International",
    "English Schools Foundation": "ESF",
    "ESF": "ESF",
}


# ── Connection Helper ───────────────────────────────────────────────────

def _get_conn():
    return psycopg2.connect(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        dbname=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
    )


# ── Normalizer ──────────────────────────────────────────────────────────

def _clean_string(val) -> Optional[str]:
    """Clean a string value: strip whitespace, return None if empty."""
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("null", "none", "n/a", "-"):
        return None
    return s


def _clean_website(val) -> Optional[str]:
    """Clean and validate website URL."""
    url = _clean_string(val)
    if not url:
        return None
    # Add http:// if missing
    if url and not url.startswith(("http://", "https://")):
        url = "http://" + url
    return url


def _clean_coordinates(val) -> Optional[float]:
    """Clean and validate latitude/longitude."""
    if val is None:
        return None
    try:
        f = float(val)
        if f == 0.0:
            return None  # 0,0 is likely missing data
        return f
    except (ValueError, TypeError):
        return None


def normalize_edb_record(raw: dict) -> dict:
    """Normalize EDB JSON record → school_entity_master row.

    Args:
        raw: Single EDB school record from JSON.

    Returns:
        Normalized dict ready for DB insert.
    """
    normalized = {}

    # Map EDB fields to master columns
    for edb_key, master_key in EDB_COLUMN_MAP.items():
        normalized[master_key] = raw.get(edb_key)

    # Clean string fields
    normalized["school_name_en"] = _clean_string(normalized.get("school_name_en")) or ""
    normalized["school_name_zh"] = _clean_string(normalized.get("school_name_zh"))
    normalized["address_en"] = _clean_string(normalized.get("address_en"))
    normalized["address_zh"] = _clean_string(normalized.get("address_zh"))
    normalized["phone"] = _clean_string(normalized.get("phone"))
    normalized["fax"] = _clean_string(normalized.get("fax"))
    normalized["email"] = _clean_string(normalized.get("email"))
    normalized["website"] = _clean_website(normalized.get("website"))
    normalized["edb_school_no"] = _clean_string(normalized.get("edb_school_no"))
    normalized["district"] = _clean_string(normalized.get("district"))
    normalized["district_code"] = _clean_string(normalized.get("district_code"))
    normalized["religion"] = _clean_string(normalized.get("religion"))

    # Normalize school_level
    level = _clean_string(normalized.get("school_level"))
    normalized["school_level"] = SCHOOL_LEVEL_MAP.get(level, level.lower() if level else None)

    # Normalize finance_type
    finance = _clean_string(normalized.get("finance_type"))
    normalized["finance_type"] = FINANCE_TYPE_MAP.get(finance, finance)

    # Clean coordinates
    normalized["latitude"] = _clean_coordinates(normalized.get("latitude"))
    normalized["longitude"] = _clean_coordinates(normalized.get("longitude"))

    # Source metadata
    normalized["source"] = "EDB"
    normalized["source_version"] = "2026-07-01"  # Default, can be overridden

    return normalized


# ── Ingestion ───────────────────────────────────────────────────────────

def ingest_edb(json_path: str, source_version: str = "2026-07-01") -> dict:
    """Ingest EDB JSON file into school_entity_master.

    Args:
        json_path: Path to EDB JSON file.
        source_version: EDB data release version (e.g., "2026-07-01").

    Returns:
        Dict with counts: {inserted, updated, failed, total, skipped_no_name}
    """
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"EDB JSON file not found: {json_path}")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # EDB JSON structure: {"data": [...], "number_of_records": N}
    # Or sometimes just a list
    if isinstance(data, dict):
        records = data.get("data", [])
    elif isinstance(data, list):
        records = data
    else:
        raise ValueError(f"Unexpected EDB JSON structure: {type(data)}")

    logger.info("EDB JSON loaded: %d records found", len(records))

    conn = _get_conn()
    inserted = 0
    updated = 0
    failed = 0
    skipped_no_name = 0

    try:
        with conn.cursor() as cur:
            for i, raw in enumerate(records):
                try:
                    normalized = normalize_edb_record(raw)
                    normalized["source_version"] = source_version

                    # Skip records with no English or Chinese name
                    if not normalized["school_name_en"] and not normalized["school_name_zh"]:
                        skipped_no_name += 1
                        continue

                    # Use upsert function
                    cur.execute(
                        """
                        SELECT memory.upsert_school_master(
                            %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s, %s
                        )
                        """,
                        (
                            normalized["edb_school_no"],
                            normalized["school_name_en"],
                            normalized["school_name_zh"],
                            normalized["school_level"],
                            normalized["district"],
                            normalized["district_code"],
                            normalized["address_en"],
                            normalized["address_zh"],
                            normalized["latitude"],
                            normalized["longitude"],
                            normalized["finance_type"],
                            normalized["religion"],
                            normalized["website"],
                            normalized["phone"],
                            normalized["email"],
                            normalized["source"],
                            normalized["source_version"],
                        ),
                    )
                    master_id = cur.fetchone()[0]

                    # Record self-mapping (EDB → master)
                    if normalized["edb_school_no"]:
                        cur.execute(
                            "SELECT memory.upsert_entity_mapping(%s, %s, %s, %s, %s, %s, %s)",
                            (
                                master_id,
                                "EDB",
                                normalized["edb_school_no"],
                                normalized["school_name_en"],
                                1.0,
                                "exact_alias",
                                True,
                            ),
                        )

                    # Count as insert or update (approximate)
                    if normalized["edb_school_no"]:
                        updated += 1  # Assume update for records with edb_school_no
                    else:
                        inserted += 1

                except Exception as e:
                    failed += 1
                    logger.warning("Failed to ingest record %d: %s", i, e)
                    if failed <= 5:
                        logger.debug("Failed record: %s", raw)

        conn.commit()

    except Exception as e:
        conn.rollback()
        logger.error("EDB ingestion failed: %s", e)
        raise
    finally:
        conn.close()

    result = {
        "inserted": inserted,
        "updated": updated,
        "failed": failed,
        "skipped_no_name": skipped_no_name,
        "total": len(records),
    }

    logger.info(
        "EDB ingestion complete: %d inserted, %d updated, %d failed, %d skipped (no name), %d total",
        inserted, updated, failed, skipped_no_name, len(records),
    )

    return result


def match_chsc_to_master(chsc_school_id: str, chsc_name_en: str, chsc_name_zh: str = None) -> Optional[int]:
    """Match a CHSC school to an existing master record.

    Matching priority:
    1. Exact English name match
    2. Exact Chinese name match
    3. Fuzzy name match (trigram similarity)

    Returns:
        school_master_id if matched, None otherwise.
    """
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            # Step 1: Exact English name
            cur.execute(
                """
                SELECT id FROM memory.school_entity_master
                WHERE LOWER(school_name_en) = LOWER(%s)
                LIMIT 1
                """,
                (chsc_name_en,),
            )
            row = cur.fetchone()
            if row:
                master_id = row[0]
                # Record mapping
                cur.execute(
                    "SELECT memory.upsert_entity_mapping(%s, %s, %s, %s, %s, %s, %s)",
                    (master_id, "CHSC", chsc_school_id, chsc_name_en, 0.95, "identity_map", False),
                )
                conn.commit()
                return master_id

            # Step 2: Exact Chinese name
            if chsc_name_zh:
                cur.execute(
                    """
                    SELECT id FROM memory.school_entity_master
                    WHERE school_name_zh = %s
                    LIMIT 1
                    """,
                    (chsc_name_zh,),
                )
                row = cur.fetchone()
                if row:
                    master_id = row[0]
                    cur.execute(
                        "SELECT memory.upsert_entity_mapping(%s, %s, %s, %s, %s, %s, %s)",
                        (master_id, "CHSC", chsc_school_id, chsc_name_en, 0.90, "identity_map", False),
                    )
                    conn.commit()
                    return master_id

            # Step 3: Fuzzy match (trigram similarity)
            cur.execute(
                """
                SELECT id, school_name_en,
                       similarity(school_name_en, %s) AS sim
                FROM memory.school_entity_master
                WHERE school_name_en % %s  -- trigram similarity operator
                ORDER BY sim DESC
                LIMIT 1
                """,
                (chsc_name_en, chsc_name_en),
            )
            row = cur.fetchone()
            if row and row[2] and row[2] > 0.5:
                master_id = row[0]
                cur.execute(
                    "SELECT memory.upsert_entity_mapping(%s, %s, %s, %s, %s, %s, %s)",
                    (master_id, "CHSC", chsc_school_id, chsc_name_en, row[2], "fuzzy", False),
                )
                conn.commit()
                return master_id

            return None

    finally:
        conn.close()


def get_master_stats() -> dict:
    """Get statistics about school_entity_master table."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            stats = {}

            cur.execute("SELECT COUNT(*) FROM memory.school_entity_master")
            stats["total_masters"] = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM memory.school_entity_master WHERE edb_school_no IS NOT NULL")
            stats["with_edb_no"] = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM memory.school_entity_master WHERE website IS NOT NULL")
            stats["with_website"] = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM memory.school_entity_master WHERE latitude IS NOT NULL")
            stats["with_coordinates"] = cur.fetchone()[0]

            cur.execute(
                "SELECT school_level, COUNT(*) FROM memory.school_entity_master GROUP BY school_level ORDER BY COUNT(*) DESC"
            )
            stats["by_level"] = dict(cur.fetchall())

            cur.execute("SELECT COUNT(*) FROM memory.school_entity_mapping")
            stats["total_mappings"] = cur.fetchone()[0]

            cur.execute(
                "SELECT source_system, COUNT(*) FROM memory.school_entity_mapping GROUP BY source_system"
            )
            stats["mappings_by_source"] = dict(cur.fetchall())

            return stats
    finally:
        conn.close()


# ── CLI Entry Point ─────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="EDB School Master Registry Ingestion")
    parser.add_argument("--input", required=True, help="Path to EDB JSON file")
    parser.add_argument("--source-version", default="2026-07-01", help="EDB data release version")
    parser.add_argument("--stats", action="store_true", help="Show master table stats and exit")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    if args.stats:
        stats = get_master_stats()
        print(json.dumps(stats, indent=2, ensure_ascii=False))
    else:
        result = ingest_edb(args.input, args.source_version)
        print(json.dumps(result, indent=2, ensure_ascii=False))
