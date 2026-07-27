# Hermes Ingestion — Qdrant Knowledge Sync
# Syncs school_entity + school_attributes to Qdrant knowledge_education_v2.
# Creates a new collection (v2), never overwrites v1 (demo data).
#
# Supports multiple data sources: CHSC (academic intelligence), EDB (master registry)

import json
import logging
import uuid
from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

from config import QDRANT_HOST, QDRANT_PORT, QDRANT_COLLECTION, QDRANT_VECTOR_SIZE
from pg_writer import get_attributes

logger = logging.getLogger("hermes.ingestion.qdrant_sync")

client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

# Zero vector — placeholder until embedding model is wired
ZERO_VECTOR = [0.0] * QDRANT_VECTOR_SIZE

# ── Source Metadata Registry ────────────────────────────────────────────
# Maps source identifier → source_meta dict for Qdrant payload
SOURCE_META_MAP = {
    "CHSC": {
        "publisher": "CHSC",
        "dataset": "secondary_school_profiles",
        "source_type": "school_profile",
    },
    "EDB": {
        "publisher": "EDB",
        "dataset": "school_location_and_data",
        "source_type": "master_registry",
    },
    "HKET": {
        "publisher": "HKET",
        "dataset": "school_popularity",
        "source_type": "popularity_signal",
    },
    "KGP": {
        "publisher": "KGP",
        "dataset": "kindergarten_profiles",
        "source_type": "school_profile",
    },
}


def ensure_collection() -> None:
    """Create knowledge_education_v2 if it doesn't exist. Never touches v1."""
    existing = {c.name for c in client.get_collections().collections}
    if QDRANT_COLLECTION not in existing:
        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(size=QDRANT_VECTOR_SIZE, distance=Distance.COSINE),
        )
        logger.info("Created collection: %s", QDRANT_COLLECTION)
    else:
        logger.info("Collection already exists: %s", QDRANT_COLLECTION)


def _build_content_blob(entity: dict, attrs: list[dict]) -> str:
    """Build a human-readable text blob for LLM context from entity + attributes."""
    attr_map = {a["attr_key"]: a["attr_value"] for a in attrs}

    lines = [
        f"Name: {entity.get('canonical_name', '')}",
        f"District: {entity.get('district', '')}",
        f"Type: {entity.get('school_type', '')}",
        f"Gender: {entity.get('student_gender', '')}",
    ]

    religion = attr_map.get("religion", "")
    if religion:
        lines.append(f"Religion: {religion}")

    sponsoring = attr_map.get("sponsoring_body", "")
    if sponsoring:
        lines.append(f"Sponsoring Body: {sponsoring}")

    # Fees
    fees_parts = []
    for i in range(1, 7):
        fee = attr_map.get(f"fees_s{i}", "")
        if fee:
            fees_parts.append(f"S{i}: ${fee}")
    if fees_parts:
        lines.append(f"Fees: {', '.join(fees_parts)}")

    # Language
    lang_policy = attr_map.get("language_policy", "")
    if lang_policy:
        lines.append(f"Language Policy: {lang_policy}")

    # Subjects S4-S6 English
    s4_eng = attr_map.get("subjects_s4_s6_english", "")
    if s4_eng:
        lines.append(f"Subjects (S4-S6 English): {s4_eng}")

    # Academic signals
    for key, val in sorted(attr_map.items()):
        if key.startswith("academic_signal_"):
            label = key.replace("academic_signal_", "").replace("_", " ").title()
            lines.append(f"Academic Signal - {label}: {val}")

    # Facilities
    facilities = [k.replace("facility_", "").replace("_", " ").title()
                  for k, v in attr_map.items()
                  if k.startswith("facility_") and v == "true"]
    if facilities:
        lines.append(f"Facilities: {', '.join(sorted(facilities))}")

    # Address
    address = attr_map.get("address", "")
    if address:
        lines.append(f"Address: {address}")

    # Mission
    mission = attr_map.get("mission", "")
    if mission:
        lines.append(f"Mission: {mission}")

    return "\n".join(lines)


def _build_payload(entity: dict, attrs: list[dict], source: str = "CHSC") -> dict:
    """Build Qdrant payload with filterable metadata fields.

    Args:
        entity: School entity dict with school_id, canonical_name, etc.
        attrs: List of {attr_key, attr_value} dicts from school_attributes table.
        source: Data source identifier ('CHSC', 'EDB', 'HKET', 'KGP').

    Returns:
        Qdrant payload dict with source-aware metadata.
    """
    attr_map = {a["attr_key"]: a["attr_value"] for a in attrs}

    # Normalize gender values from raw source to standard form
    raw_gender = entity.get("student_gender", "")
    normalized_gender = _normalize_gender(raw_gender)

    # Source metadata from registry
    source_meta = SOURCE_META_MAP.get(source, {
        "publisher": source,
        "dataset": "",
        "source_type": "",
    })

    payload = {
        "school_id": entity["school_id"],
        "name": entity.get("canonical_name", ""),
        "district": entity.get("district", ""),
        "school_type": entity.get("school_type", ""),
        "student_gender": normalized_gender,
        "source": source,
        "source_version": entity.get("source_version", ""),
        "source_meta": source_meta,
        "confidence": 1.0,
        "content": _build_content_blob(entity, attrs),
    }

    # Add filterable numeric fields (fees from CHSC)
    for i in range(1, 7):
        fee_str = attr_map.get(f"fees_s{i}", "")
        if fee_str and fee_str.isdigit():
            payload[f"fees_s{i}"] = int(fee_str)

    # Add religion filter
    religion = attr_map.get("religion", "")
    if religion:
        payload["religion"] = religion

    # Add boolean facility flags as filterable fields
    for k, v in attr_map.items():
        if k.startswith("facility_") and v == "true":
            payload[k] = True

    # Add academic signal fields as explicit payload (for ranking)
    for k, v in attr_map.items():
        if k.startswith("academic_signal_") and v:
            payload[k] = v

    # ── EDB-specific fields ────────────────────────────────────────────
    # EDB provides geo coordinates and website — critical for Master Registry
    if source == "EDB":
        if entity.get("latitude"):
            payload["latitude"] = entity["latitude"]
        if entity.get("longitude"):
            payload["longitude"] = entity["longitude"]
        if entity.get("website"):
            payload["website"] = entity["website"]
        # EDB address fields may be in entity directly
        if entity.get("address_en"):
            payload["address"] = entity["address_en"]

    return payload


def _normalize_gender(raw: str) -> str:
    """Normalize CHSC gender values to standard form.
    'Boys' → 'boys_only', 'Girls' → 'girls_only', 'Co-ed' → 'co_ed'.
    """
    lower = raw.strip().lower()
    if lower in ("boys", "boys_only", "male"):
        return "boys_only"
    if lower in ("girls", "girls_only", "female"):
        return "girls_only"
    if lower in ("co-ed", "co_ed", "coed", "mixed"):
        return "co_ed"
    return raw  # fallback to original if unrecognized


def _school_id_to_point_id(school_id: str) -> str:
    """Generate UUID-based point ID from school_id (source-agnostic).

    Uses UUID5 with DNS namespace for deterministic, collision-free IDs.
    This replaces the old integer encoding (int(school_id.split("-")[1]))
    which broke when multiple sources had overlapping integer ranges.

    Args:
        school_id: School identifier (e.g., "SCH-00166", "EDB-123456").

    Returns:
        UUID string suitable for Qdrant point ID.
    """
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, school_id))


def sync_school(school_id: str, entity: dict, source: str = "CHSC") -> bool:
    """Sync one school entity + its attributes to Qdrant. Returns True on success.

    Args:
        school_id: School identifier.
        entity: School entity dict.
        source: Data source identifier ('CHSC', 'EDB', 'HKET', 'KGP').
    """
    attrs = get_attributes(school_id)
    payload = _build_payload(entity, attrs, source=source)

    try:
        client.upsert(
            collection_name=QDRANT_COLLECTION,
            points=[{
                "id": _school_id_to_point_id(school_id),
                "vector": ZERO_VECTOR,
                "payload": payload,
            }],
        )
        return True
    except Exception as e:
        logger.error("Qdrant upsert failed for %s (source=%s): %s", school_id, source, e)
        return False


def sync_all(entities: list[dict], source: str = "CHSC") -> int:
    """Sync all school entities to Qdrant. Returns count synced.

    Args:
        entities: List of school entity dicts.
        source: Data source identifier.
    """
    ensure_collection()
    synced = 0
    for entity in entities:
        if sync_school(entity["school_id"], entity, source=source):
            synced += 1
    logger.info("Synced %d/%d schools to %s (source=%s)", synced, len(entities), QDRANT_COLLECTION, source)
    return synced


def collection_count() -> int:
    """Return point count in the education_v2 collection."""
    try:
        info = client.get_collection(QDRANT_COLLECTION)
        return info.points_count or 0
    except Exception:
        return 0


def collection_exists() -> bool:
    existing = {c.name for c in client.get_collections().collections}
    return QDRANT_COLLECTION in existing
