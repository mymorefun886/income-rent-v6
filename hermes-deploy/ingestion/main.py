# Hermes Ingestion — Entry Point
# FastAPI service: CHSC school data pipeline (raw → normalize → entity → Qdrant).

import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
import uvicorn

from config import QDRANT_COLLECTION, CHSC_SOURCES
from downloader import download_all, download_source
from normalizer import normalize_row
from entity_resolver import resolve, _detect_language, _normalize_for_match
from pg_writer import (
    ensure_schema, insert_raw_batch, raw_count_for_version,
    upsert_entity, upsert_identity, upsert_attributes_batch, get_stats,
)
from qdrant_sync import sync_all, ensure_collection, collection_count, collection_exists
from models import IngestionRun, IngestionStatus, SchoolAttribute, SchoolIdentityEntry

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("hermes.ingestion")

_last_run: dict = {}
_total_raw_rows: int = 0


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_schema()
    yield


app = FastAPI(title="Hermes Ingestion", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    stats = get_stats()
    return {
        "status": "ok",
        "service": "hermes-ingestion",
        "qdrant_collection": QDRANT_COLLECTION,
        "qdrant_exists": collection_exists(),
        "qdrant_points": collection_count(),
        **stats,
    }


@app.post("/ingestion/raw")
async def ingest_raw(source_version: str = "2025_2026_en"):
    """Ingest raw CSV rows into raw_school_source. Idempotent (replaces by version)."""
    global _total_raw_rows

    source = next((s for s in CHSC_SOURCES if s["version"] == source_version), None)
    if source is None:
        return {"error": f"Unknown source version: {source_version}", "available": [s["version"] for s in CHSC_SOURCES]}

    existing = raw_count_for_version(source["name"], source_version)
    if existing > 0:
        return {"status": "skipped", "reason": f"{existing} rows already ingested for {source_version}", "existing_rows": existing}

    records = download_source(source)
    count = insert_raw_batch(records)
    _total_raw_rows += count

    return {
        "status": "ok",
        "source_name": source["name"],
        "source_version": source_version,
        "rows_ingested": count,
        "checksum": records[0].checksum if records else "",
    }


@app.post("/ingestion/preview")
async def preview_ingestion(source_version: str = "2025_2026_en"):
    """Dry-run: parse CSV, run normalize + entity resolution without writing to DB.
    Returns row counts, unique entity estimate, attribute coverage stats."""
    source = next((s for s in CHSC_SOURCES if s["version"] == source_version), None)
    if source is None:
        return {"error": f"Unknown source version: {source_version}", "available": [s["version"] for s in CHSC_SOURCES]}

    from downloader import download_source, parse_csv_rows, read_csv_from_disk
    from normalizer import normalize_row
    from entity_resolver import resolve, _detect_language, _normalize_for_match

    try:
        checksum, data = read_csv_from_disk(source["local_path"])
    except FileNotFoundError:
        return {"error": f"CSV not found at {source['local_path']}", "hint": "Download CSV to cold storage first (Gate 4)"}

    rows = parse_csv_rows(data)
    csv_row_count = len(rows)
    if csv_row_count == 0:
        return {"error": "CSV parsed 0 rows", "csv_rows": 0}

    # In-memory dry run
    resolved_ids: set[str] = set()
    new_ids: set[str] = set()
    all_attr_keys: set[str] = set()
    attrs_per_school: list[int] = []
    district_counts: dict[str, int] = {}
    type_counts: dict[str, int] = {}
    gender_counts: dict[str, int] = {}
    errors: list[str] = []
    sample_entities: list[dict] = []

    for i, row in enumerate(rows):
        try:
            entity, attrs = normalize_row(row)
            name = entity.get("canonical_name", "")
            if not name:
                continue

            normalized = _normalize_for_match(name)
            lang = _detect_language(name)

            # Resolve without writing — track uniqueness
            resolved_id = normalized  # use normalized name as proxy ID for counting
            resolved_ids.add(resolved_id)

            # Track stats
            d = entity.get("district", "")
            if d:
                district_counts[d] = district_counts.get(d, 0) + 1
            t = entity.get("school_type", "")
            if t:
                type_counts[t] = type_counts.get(t, 0) + 1
            g = entity.get("student_gender", "")
            if g:
                gender_counts[g] = gender_counts.get(g, 0) + 1

            attr_keys = {a.attr_key for a in attrs}
            all_attr_keys.update(attr_keys)
            attrs_per_school.append(len(attr_keys))

            if i < 3:
                sample_entities.append({
                    "name": name,
                    "district": d,
                    "school_type": t,
                    "gender": g,
                    "attribute_count": len(attr_keys),
                    "academic_signals": [a.attr_value for a in attrs if a.attr_key.startswith("academic_signal_")],
                })
        except Exception as e:
            errors.append(f"Row {i}: {str(e)[:100]}")

    attr_coverage_pct = round(len(attrs_per_school) / csv_row_count * 100, 1) if csv_row_count > 0 else 0
    avg_attrs = round(sum(attrs_per_school) / len(attrs_per_school), 1) if attrs_per_school else 0

    return {
        "status": "preview",
        "source_version": source_version,
        "csv_rows": csv_row_count,
        "estimated_unique_schools": len(resolved_ids),
        "dedup_ratio": round(len(resolved_ids) / csv_row_count, 4) if csv_row_count > 0 else 0,
        "attribute_keys_total": len(all_attr_keys),
        "avg_attributes_per_school": avg_attrs,
        "attribute_coverage_pct": attr_coverage_pct,
        "districts": district_counts,
        "school_types": type_counts,
        "gender_distribution": gender_counts,
        "sample": sample_entities,
        "parse_errors": len(errors),
        "parse_error_details": errors[:5],
    }


@app.post("/ingestion/run")
async def run_full_pipeline(source_version: str = "2025_2026_en"):
    """Run the full ingestion pipeline: raw → normalize → entity → qdrant."""
    run_id = str(uuid.uuid4())[:8]
    started = datetime.now(timezone.utc).isoformat()

    source = next((s for s in CHSC_SOURCES if s["version"] == source_version), None)
    if source is None:
        return {"error": f"Unknown source version: {source_version}"}

    errors = []
    entities_created = 0
    entities_updated = 0
    entities_skipped = 0
    total_raw = 0

    # Step 1: Raw ingestion
    try:
        existing = raw_count_for_version(source["name"], source_version)
        if existing == 0:
            records = download_source(source)
            raw_count = insert_raw_batch(records)
            total_raw = raw_count
            logger.info("Step 1/4: Raw ingestion — %d rows", raw_count)
        else:
            total_raw = existing
            logger.info("Step 1/4: Raw already ingested — %d rows", existing)
    except Exception as e:
        errors.append(f"raw_ingestion: {e}")
        logger.error("Raw ingestion failed: %s", e)
        return {
            "status": "error", "run_id": run_id, "step": "raw",
            "error": str(e),
        }

    # Step 2: Normalize
    from pg_writer import get_raw_by_version
    raw_rows = get_raw_by_version(source["name"], source_version)

    if not raw_rows:
        raw_rows = [r.raw_data for r in records] if 'records' in dir() else []
        if not raw_rows:
            return {"status": "error", "run_id": run_id, "step": "normalize", "error": "No raw rows found"}

    try:
        for row in raw_rows:
            entity, attrs = normalize_row(row)

            canonical_name = entity.get("canonical_name", "")
            if not canonical_name:
                entities_skipped += 1
                continue

            # Step 3: Entity resolution
            district = entity.get("district", "")
            language = _detect_language(canonical_name)
            resolved_id, is_new = resolve(canonical_name, language, f"CHSC_{source_version}")

            if is_new:
                entities_created += 1
            else:
                entities_updated += 1

            # Upsert entity
            try:
                upsert_entity(
                    school_id=resolved_id,
                    canonical_name=canonical_name,
                    district=district,
                    school_type=entity.get("school_type", ""),
                    student_gender=entity.get("student_gender", ""),
                    source_name=source["name"],
                    source_version=source_version,
                )
            except Exception as e:
                errors.append(f"upsert_entity failed for {resolved_id} ({canonical_name}): {e}")
                logger.error("upsert_entity: school_id=%s gender=%r error=%s", resolved_id, entity.get("student_gender"), e)
                raise

            # Create identity entry for new entities
            if is_new:
                try:
                    upsert_identity(SchoolIdentityEntry(
                        school_id=resolved_id, language=language,
                        name=canonical_name, normalized_name=_normalize_for_match(canonical_name),
                        source=f"CHSC_{source_version}", confidence=1.0,
                    ))
                except Exception as e:
                    errors.append(f"upsert_identity failed for {resolved_id} ({canonical_name}): {e}")
                    logger.error("upsert_identity: school_id=%s lang=%s name_len=%d error=%s", resolved_id, language, len(canonical_name), e)
                    raise

            # Upsert attributes
            try:
                for attr in attrs:
                    attr.school_id = resolved_id
                upsert_attributes_batch(attrs)
            except Exception as e:
                errors.append(f"upsert_attributes failed for {resolved_id}: {e}")
                logger.error("upsert_attributes: school_id=%s attr_count=%d error=%s", resolved_id, len(attrs), e)
                raise

        logger.info("Step 2+3/4: Normalize + Entity — %d created, %d updated, %d skipped",
                    entities_created, entities_updated, entities_skipped)
    except Exception as e:
        errors.append(f"normalize: {e}")
        logger.error("Normalize/entity failed: %s", e)
        return {"status": "error", "run_id": run_id, "step": "normalize", "error": str(e)}

    # Step 4: Qdrant sync
    try:
        from pg_writer import _get_conn
        conn = _get_conn()
        entities_for_sync = []
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT school_id, canonical_name, district, school_type, student_gender, source_name, source_version FROM memory.school_entity"
                )
                columns = ["school_id", "canonical_name", "district", "school_type",
                          "student_gender", "source_name", "source_version"]
                for row in cur.fetchall():
                    entities_for_sync.append(dict(zip(columns, row)))
        finally:
            conn.close()

        qdrant_synced = sync_all(entities_for_sync)
        logger.info("Step 4/4: Qdrant sync — %d schools", qdrant_synced)
    except Exception as e:
        errors.append(f"qdrant_sync: {e}")
        logger.error("Qdrant sync failed: %s", e)
        qdrant_synced = 0

    completed = datetime.now(timezone.utc).isoformat()

    result = {
        "status": "completed" if not errors else "completed_with_errors",
        "run_id": run_id,
        "source_version": source_version,
        "raw_rows": total_raw,
        "entities_created": entities_created,
        "entities_updated": entities_updated,
        "entities_skipped": entities_skipped,
        "qdrant_synced": qdrant_synced,
        "errors": errors,
        "started_at": started,
        "completed_at": completed,
    }

    global _last_run
    _last_run = result

    return result


@app.get("/ingestion/status")
async def ingestion_status():
    stats = get_stats()
    return {
        "last_run": _last_run or {},
        "total_schools": stats.get("school_entity", 0),
        "total_attributes": stats.get("school_attributes", 0),
        "identity_entries": stats.get("school_identity_map", 0),
        "raw_records": stats.get("raw_school_source", 0),
        "aliases": stats.get("school_alias", 0),
        "qdrant_collection": QDRANT_COLLECTION,
        "qdrant_points": collection_count(),
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
