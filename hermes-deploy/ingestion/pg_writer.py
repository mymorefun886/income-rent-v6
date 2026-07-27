# Hermes Ingestion — PostgreSQL Writer
# Schema migration, CRUD for school data tables, and recommendation history.

import hashlib
import logging
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

from config import (
    POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB,
    POSTGRES_USER, POSTGRES_PASSWORD,
)
from models import (
    RawSchoolRecord, SchoolEntity, SchoolAttribute, SchoolIdentityEntry,
)

logger = logging.getLogger("hermes.ingestion.pg_writer")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS memory.raw_school_source (
    id SERIAL PRIMARY KEY,
    source_name VARCHAR(128) NOT NULL,
    source_version VARCHAR(64) NOT NULL,
    source_url TEXT,
    checksum VARCHAR(128),
    raw_data JSONB NOT NULL,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memory.school_entity (
    id SERIAL PRIMARY KEY,
    school_id VARCHAR(16) NOT NULL UNIQUE,
    canonical_name VARCHAR(256) NOT NULL,
    district VARCHAR(128),
    school_type VARCHAR(64),
    student_gender VARCHAR(16),
    source_name VARCHAR(128) NOT NULL,
    source_version VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memory.school_attributes (
    id SERIAL PRIMARY KEY,
    school_id VARCHAR(16) NOT NULL REFERENCES memory.school_entity(school_id),
    attr_key VARCHAR(64) NOT NULL,
    attr_value TEXT NOT NULL,
    attr_group VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, attr_key)
);

CREATE TABLE IF NOT EXISTS memory.school_identity_map (
    id SERIAL PRIMARY KEY,
    school_id VARCHAR(16) NOT NULL REFERENCES memory.school_entity(school_id),
    language VARCHAR(8) NOT NULL,
    name VARCHAR(256) NOT NULL,
    normalized_name VARCHAR(256) NOT NULL,
    source VARCHAR(64),
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, language)
);

CREATE TABLE IF NOT EXISTS memory.school_alias (
    id SERIAL PRIMARY KEY,
    school_id VARCHAR(16) NOT NULL REFERENCES memory.school_entity(school_id),
    alias VARCHAR(256) NOT NULL,
    alias_normalized VARCHAR(256) NOT NULL,
    source VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase 10.2: Recommendation History (parallel with ingestion)
CREATE TABLE IF NOT EXISTS memory.recommendation_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL DEFAULT 'default',
    decision_id UUID,
    child_profile JSONB,
    family_constraints JSONB,
    total_schools_considered INTEGER,
    total_ranked INTEGER,
    engine_version VARCHAR(32),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memory.recommendation_result (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES memory.recommendation_session(id),
    school_id VARCHAR(16) NOT NULL REFERENCES memory.school_entity(school_id),
    rank INTEGER NOT NULL,
    constraint_score REAL,
    fit_score REAL,
    overall_score REAL,
    match_reasons JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, school_id)
);

CREATE TABLE IF NOT EXISTS memory.recommendation_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES memory.recommendation_result(id),
    user_id VARCHAR(64) NOT NULL DEFAULT 'default',
    action VARCHAR(16) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_source ON memory.raw_school_source(source_name, source_version);
CREATE INDEX IF NOT EXISTS idx_school_entity_district ON memory.school_entity(district);
CREATE INDEX IF NOT EXISTS idx_school_entity_type ON memory.school_entity(school_type);
CREATE INDEX IF NOT EXISTS idx_school_attr_school ON memory.school_attributes(school_id);
CREATE INDEX IF NOT EXISTS idx_school_attr_key ON memory.school_attributes(attr_key);
CREATE INDEX IF NOT EXISTS idx_identity_map_normalized ON memory.school_identity_map(normalized_name);
CREATE INDEX IF NOT EXISTS idx_identity_map_name ON memory.school_identity_map(name);
CREATE INDEX IF NOT EXISTS idx_alias_normalized ON memory.school_alias(alias_normalized);
CREATE INDEX IF NOT EXISTS idx_rec_session_user ON memory.recommendation_session(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_session_decision ON memory.recommendation_session(decision_id);
CREATE INDEX IF NOT EXISTS idx_rec_result_session ON memory.recommendation_result(session_id);
CREATE INDEX IF NOT EXISTS idx_rec_feedback_result ON memory.recommendation_feedback(result_id);
"""


def _get_conn():
    return psycopg2.connect(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        dbname=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
    )


def ensure_schema() -> None:
    """Create all ingestion tables if they don't exist. Idempotent."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(SCHEMA_SQL)
        conn.commit()
        logger.info("Ingestion schema ensured")
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Raw School Source
# ---------------------------------------------------------------------------

def insert_raw_batch(records: list[RawSchoolRecord]) -> int:
    """Insert raw CSV rows. Returns count inserted."""
    conn = _get_conn()
    count = 0
    now = datetime.now(timezone.utc).isoformat()
    try:
        with conn.cursor() as cur:
            for rec in records:
                cur.execute(
                    """INSERT INTO memory.raw_school_source
                       (source_name, source_version, source_url, checksum, raw_data, ingested_at)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (rec.source_name, rec.source_version, rec.source_url,
                     rec.checksum, psycopg2.extras.Json(rec.raw_data), now),
                )
                count += 1
        conn.commit()
    finally:
        conn.close()
    return count


def raw_count_for_version(source_name: str, source_version: str) -> int:
    """Check how many raw rows exist for a given source version."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM memory.raw_school_source WHERE source_name=%s AND source_version=%s",
                (source_name, source_version),
            )
            return cur.fetchone()[0]
    finally:
        conn.close()


def get_raw_by_version(source_name: str, source_version: str) -> list[dict]:
    """Retrieve all raw rows for a source version (for normalization)."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT raw_data FROM memory.raw_school_source WHERE source_name=%s AND source_version=%s ORDER BY id",
                (source_name, source_version),
            )
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# School Entity
# ---------------------------------------------------------------------------

def upsert_entity(school_id: str, canonical_name: str, district: str = "",
                  school_type: str = "", student_gender: str = "",
                  source_name: str = "", source_version: str = "") -> str:
    """Insert or update a school entity. Returns the school_id."""
    conn = _get_conn()
    now = datetime.now(timezone.utc).isoformat()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO memory.school_entity
                   (school_id, canonical_name, district, school_type, student_gender, source_name, source_version, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (school_id) DO UPDATE SET
                     canonical_name = EXCLUDED.canonical_name,
                     district = EXCLUDED.district,
                     school_type = EXCLUDED.school_type,
                     student_gender = EXCLUDED.student_gender,
                     source_name = EXCLUDED.source_name,
                     source_version = EXCLUDED.source_version,
                     updated_at = EXCLUDED.updated_at""",
                (school_id, canonical_name, district, school_type, student_gender,
                 source_name, source_version, now),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("upsert_entity FAILED: school_id=%r (len=%d) canonical_name=%r (len=%d) district=%r (len=%d) school_type=%r (len=%d) student_gender=%r (len=%d) source_name=%r (len=%d) source_version=%r (len=%d)",
                     school_id, len(school_id), canonical_name, len(canonical_name), district, len(district),
                     school_type, len(school_type), student_gender, len(student_gender),
                     source_name, len(source_name), source_version, len(source_version))
        logger.error("Full error: %s", e)
        raise
    finally:
        conn.close()
    return school_id


def get_next_school_id() -> str:
    """Generate the next sequential school_id."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT MAX(id) FROM memory.school_entity")
            max_id = cur.fetchone()[0] or 0
            return f"SCH-{max_id + 1:05d}"
    finally:
        conn.close()


def entity_count() -> int:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM memory.school_entity")
            return cur.fetchone()[0]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# School Attributes
# ---------------------------------------------------------------------------

def upsert_attribute(school_id: str, attr_key: str, attr_value: str,
                     attr_group: str = "") -> None:
    """Insert or update a single school attribute."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO memory.school_attributes (school_id, attr_key, attr_value, attr_group)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT (school_id, attr_key) DO UPDATE SET
                     attr_value = EXCLUDED.attr_value,
                     attr_group = EXCLUDED.attr_group""",
                (school_id, attr_key, attr_value, attr_group),
            )
        conn.commit()
    finally:
        conn.close()


def upsert_attributes_batch(attrs: list[SchoolAttribute]) -> int:
    """Batch upsert school attributes. Returns count."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            for a in attrs:
                cur.execute(
                    """INSERT INTO memory.school_attributes (school_id, attr_key, attr_value, attr_group)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT (school_id, attr_key) DO UPDATE SET
                         attr_value = EXCLUDED.attr_value,
                         attr_group = EXCLUDED.attr_group""",
                    (a.school_id, a.attr_key, a.attr_value, a.attr_group),
                )
        conn.commit()
    finally:
        conn.close()
    return len(attrs)


def get_attributes(school_id: str) -> list[dict]:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT attr_key, attr_value, attr_group FROM memory.school_attributes WHERE school_id=%s ORDER BY attr_key",
                (school_id,),
            )
            return [{"attr_key": r[0], "attr_value": r[1], "attr_group": r[2]} for r in cur.fetchall()]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# School Identity Map
# ---------------------------------------------------------------------------

def upsert_identity(entry: SchoolIdentityEntry) -> None:
    """Insert or update a language-specific school name entry."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO memory.school_identity_map
                   (school_id, language, name, normalized_name, source, confidence)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   ON CONFLICT (school_id, language) DO UPDATE SET
                     name = EXCLUDED.name,
                     normalized_name = EXCLUDED.normalized_name,
                     source = EXCLUDED.source,
                     confidence = EXCLUDED.confidence""",
                (entry.school_id, entry.language, entry.name,
                 entry.normalized_name, entry.source, entry.confidence),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("upsert_identity FAILED: school_id=%r (len=%d) language=%r (len=%d) name=%r (len=%d) normalized_name=%r (len=%d) source=%r (len=%d)",
                     entry.school_id, len(entry.school_id), entry.language, len(entry.language),
                     entry.name, len(entry.name), entry.normalized_name, len(entry.normalized_name),
                     entry.source, len(entry.source))
        logger.error("Full error: %s", e)
        raise
    finally:
        conn.close()


def lookup_by_normalized_name(normalized_name: str) -> str | None:
    """Find school_id by normalized name. Returns None if not found."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT school_id FROM memory.school_identity_map WHERE normalized_name=%s LIMIT 1",
                (normalized_name,),
            )
            row = cur.fetchone()
            return row[0] if row else None
    finally:
        conn.close()


def lookup_by_alias(alias_normalized: str) -> str | None:
    """Find school_id by alias normalized name."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT school_id FROM memory.school_alias WHERE alias_normalized=%s LIMIT 1",
                (alias_normalized,),
            )
            row = cur.fetchone()
            return row[0] if row else None
    finally:
        conn.close()


def insert_alias(school_id: str, alias: str, alias_normalized: str, source: str = "") -> None:
    """Record a known alias for a school."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO memory.school_alias (school_id, alias, alias_normalized, source)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT DO NOTHING""",
                (school_id, alias, alias_normalized, source),
            )
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

def get_stats() -> dict:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            stats = {}
            for table in ["school_entity", "school_attributes", "school_identity_map",
                          "school_alias", "raw_school_source"]:
                cur.execute(f"SELECT COUNT(*) FROM memory.{table}")
                stats[table] = cur.fetchone()[0]
            return stats
    finally:
        conn.close()
