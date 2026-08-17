-- 001_init_schema.sql
-- aiOS Education Data Platform — Architecture v1
-- Phase 1: School Master + Profile + Vacancy + School Net
-- Design: raw → core → view, SCH_CODE as natural primary key
--
-- Prerequisites:
--   CREATE EXTENSION IF NOT EXISTS postgis;
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. SCHEMAS
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS system;

-- edu schema is for compatibility views only; phase 1 reuses the old schema name
-- if a fresh edu schema is needed, uncomment:
-- CREATE SCHEMA IF NOT EXISTS edu;

-- =============================================================================
-- 2. SYSTEM — sync governance
-- =============================================================================

-- 2.1 One row per data source. Tracks current state.
CREATE TABLE system.sync_source (
    source_name     TEXT PRIMARY KEY,           -- e.g. 'csdi_school_master'
    source_type     TEXT NOT NULL,              -- 'csdi_wfs', 'csdi_arcgis', 'ckan_csv', 'http_csv'
    endpoint        TEXT NOT NULL,              -- URL or CSDI dataset_id
    update_freq     TEXT,                       -- 'monthly', 'annual', 'as_needed', 'quarterly'
    last_sync_at    TIMESTAMPTZ,                -- last attempt (success or fail)
    last_success_at TIMESTAMPTZ,                -- last successful sync
    source_hash     TEXT,                       -- SHA256 of last downloaded payload
    row_count       INTEGER,                    -- rows in the latest payload
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_source_type ON system.sync_source (source_type);

-- 2.2 One row per sync execution. Records audit trail.
CREATE TABLE system.sync_log (
    id              BIGSERIAL PRIMARY KEY,
    source_name     TEXT NOT NULL REFERENCES system.sync_source (source_name),
    started_at      TIMESTAMPTZ NOT NULL,
    finished_at     TIMESTAMPTZ,
    status          TEXT NOT NULL,              -- 'ok', 'unchanged', 'error'
    rows_before     INTEGER,
    rows_after      INTEGER,
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_log_source  ON system.sync_log (source_name);
CREATE INDEX idx_sync_log_started ON system.sync_log (started_at DESC);

-- =============================================================================
-- 3. RAW — source mirrors (JSONB, no transformation)
-- =============================================================================

-- 3.1 CSDI School Master (16 school-type layers from EDB)
CREATE TABLE raw.school_master (
    id              BIGSERIAL PRIMARY KEY,
    source_name     TEXT NOT NULL,              -- e.g. 'csdi_aided_primary', 'csdi_govt_secondary'
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_hash     TEXT,
    payload         JSONB NOT NULL              -- GeoJSON Feature or FeatureCollection
);

CREATE INDEX idx_raw_school_master_source ON raw.school_master (source_name);
CREATE INDEX idx_raw_school_master_payload ON raw.school_master USING GIN (payload);

-- 3.2 CHSC School Profile (annual CSV from chsc.hk)
CREATE TABLE raw.school_profile (
    id              BIGSERIAL PRIMARY KEY,
    source_name     TEXT NOT NULL,              -- 'chsc_primary_profile', 'chsc_secondary_profile'
    fetched_at      TIMESTAMPTZ DEFAULT NOW(),
    source_hash     TEXT,
    payload         JSONB NOT NULL              -- CSV rows as JSON array of objects
);

-- 3.3 EDB KG Vacancy (CSV from edb.gov.hk)
CREATE TABLE raw.school_vacancy (
    id              BIGSERIAL PRIMARY KEY,
    source_name     TEXT NOT NULL,              -- 'edb_kg_vacancy'
    fetched_at      TIMESTAMPTZ DEFAULT NOW(),
    source_hash     TEXT,
    payload         JSONB NOT NULL
);

-- 3.4 CSDI School Net POA + SSPA
CREATE TABLE raw.school_net (
    id              BIGSERIAL PRIMARY KEY,
    source_name     TEXT NOT NULL,              -- 'csdi_poa_net', 'csdi_sspa_net'
    fetched_at      TIMESTAMPTZ DEFAULT NOW(),
    source_hash     TEXT,
    payload         JSONB NOT NULL
);

-- =============================================================================
-- 4. CORE — unified data model
-- =============================================================================

-- 4.1 The central entity. SCH_CODE is the natural primary key across HK education.
CREATE TABLE core.school (
    school_code         TEXT PRIMARY KEY,           -- EDB SCH_CODE, e.g. '123456'
    name_tc             TEXT,
    name_en             TEXT,
    level               TEXT,                       -- 'kindergarten','primary','secondary','special'
    school_type         TEXT,                       -- 'aided','govt','private','dss','esf','international','caput'
    district            TEXT,                       -- e.g. 'Yau Tsim Mong', 'Sha Tin'
    address_tc          TEXT,
    address_en          TEXT,
    phone               TEXT,
    website             TEXT,
    gender              TEXT,                       -- 'coed','boys','girls'
    religion            TEXT,                       -- from CHSC profile (optional)
    geom                GEOMETRY(Point, 4326),
    source_modified_at  TIMESTAMPTZ,                -- the upstream last-modified timestamp
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_school_level    ON core.school (level);
CREATE INDEX idx_school_type     ON core.school (school_type);
CREATE INDEX idx_school_district ON core.school (district);
CREATE INDEX idx_school_geom     ON core.school USING GIST (geom);

-- 4.2 Cross-system identity mapping. Links CHSC/Vacancy/DSS IDs to SCH_CODE.
--     CSDI sources use SCH_CODE natively and do not require entries here.
CREATE TABLE core.school_alias (
    source_name     TEXT NOT NULL,              -- 'chsc_primary','chsc_secondary','vacancy','dss'
    external_id     TEXT NOT NULL,              -- the source's own identifier
    school_code     TEXT NOT NULL REFERENCES core.school (school_code),
    name_raw        TEXT,                       -- school name as written in source
    confidence      REAL,                       -- fuzzy-match confidence 0..1 (null for exact match)
    verified        BOOLEAN DEFAULT FALSE,      -- manually confirmed
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (source_name, external_id)
);

-- 4.3 School profile from CHSC (annual snapshot). Composite PK preserves history.
CREATE TABLE core.school_profile (
    school_code         TEXT NOT NULL REFERENCES core.school (school_code),
    school_year         TEXT NOT NULL,              -- e.g. '2025'
    student_count       INTEGER,
    teacher_count       INTEGER,
    class_count         INTEGER,
    religion            TEXT,
    medium_of_instruction TEXT,                     -- e.g. 'Chinese', 'English'
    profile_json        JSONB,                      -- full CHSC row for flexible access
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (school_code, school_year)
);

CREATE INDEX idx_school_profile_year ON core.school_profile (school_year);

-- 4.4 KG vacancy by school, year, and grade level
CREATE TABLE core.school_vacancy (
    school_code     TEXT NOT NULL REFERENCES core.school (school_code),
    school_year     TEXT NOT NULL,                  -- e.g. '2025/26'
    grade           TEXT NOT NULL,                  -- 'K1','K2','K3'
    vacancy_count   INTEGER,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (school_code, school_year, grade)
);

-- 4.5 School-to-net assignment. Supports POA (primary) and SSPA (secondary).
CREATE TABLE core.school_net (
    school_code     TEXT NOT NULL REFERENCES core.school (school_code),
    net_type        TEXT NOT NULL,                  -- 'POA' or 'SSPA'
    net_code        TEXT NOT NULL,                  -- e.g. '41', 'KL5'
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (school_code, net_type, net_code)
);
