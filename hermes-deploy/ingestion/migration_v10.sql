-- Hermes OS — Phase 10.1 Migration
-- School Data Foundation + Recommendation History
-- Run against hermes database: psql -U hermes -d hermes -f migration_v10.sql
-- Idempotent — all tables use IF NOT EXISTS.

BEGIN;

-- =========================================================================
-- Phase 10.1: School Data Foundation
-- =========================================================================

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

-- =========================================================================
-- Phase 10.2: Recommendation History (parallel)
-- =========================================================================

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

-- =========================================================================
-- Indexes
-- =========================================================================

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

COMMIT;
