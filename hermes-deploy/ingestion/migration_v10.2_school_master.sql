-- =========================================================================
-- Phase 10.2: Education Data Foundation — School Master Registry
-- EDB (data.gov.hk) as School Master Registry, not academic source
--
-- Tables:
--   1. memory.school_entity_master  — official school identity (EDB anchor)
--   2. memory.school_cost_profile   — time-sensitive, source-sensitive fee data
--   3. memory.school_entity_mapping — cross-source entity mapping (EDB↔CHSC↔HKET)
--
-- IMPORTANT: This migration is IDEMPOTIENT — safe to run multiple times.
-- All CREATE TABLE/INDEX use IF NOT EXISTS.
--
-- Data source roles:
--   EDB   → School Master Registry (identity, address, coordinates, website)  credibility 9.0
--   CHSC  → Academic Intelligence (Band, academic signals, facilities, fees)  credibility 8.0
--   HKET  → Popularity / Parent Signal (hot lists, parent attention)          credibility 5.0
--   KGP   → Kindergarten Intelligence                                        credibility 8.0
-- =========================================================================

-- =========================================================================
-- 1. SCHOOL ENTITY MASTER TABLE
--    Official school identity from EDB (data.gov.hk)
--    Anchor table for all cross-source entity resolution
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_entity_master (
    id                  SERIAL PRIMARY KEY,
    edb_school_no       VARCHAR(20) UNIQUE,           -- EDB official school number (NULL if not from EDB)
    school_name_en      TEXT NOT NULL,
    school_name_zh      TEXT,
    school_level        VARCHAR(50),                   -- kindergarten / primary / secondary / special
    district            VARCHAR(100),
    district_code       VARCHAR(20),
    address_en          TEXT,
    address_zh          TEXT,
    latitude            REAL,
    longitude           REAL,
    finance_type        VARCHAR(50),                   -- Government / Aided / DSS / Private / International
    religion            VARCHAR(100),
    website             TEXT,
    phone               VARCHAR(50),
    email               TEXT,
    source              VARCHAR(50) DEFAULT 'EDB',     -- EDB / CHSC / MANUAL
    source_version      VARCHAR(50),                   -- e.g., "2026-07-01"
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_school_master_edb_no
    ON memory.school_entity_master(edb_school_no)
    WHERE edb_school_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_school_master_level
    ON memory.school_entity_master(school_level);

CREATE INDEX IF NOT EXISTS idx_school_master_district
    ON memory.school_entity_master(district);

CREATE INDEX IF NOT EXISTS idx_school_master_finance
    ON memory.school_entity_master(finance_type);

CREATE INDEX IF NOT EXISTS idx_school_master_name_en
    ON memory.school_entity_master (school_name_en text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_school_master_name_zh
    ON memory.school_entity_master(school_name_zh)
    WHERE school_name_zh IS NOT NULL;

-- GIN trigram index for fuzzy name matching (requires pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_school_master_name_en_trgm
    ON memory.school_entity_master USING gin(school_name_en gin_trgm_ops);


-- =========================================================================
-- 2. SCHOOL COST PROFILE TABLE
--    Time-sensitive, source-sensitive fee data
--    Do NOT merge into school_entity_master — fees change yearly
--
--    Cost types: tuition / lunch / activity / uniform / bus / other
--    Source: school_website / chsc / parent_report / manual
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_cost_profile (
    id                  SERIAL PRIMARY KEY,
    school_master_id    INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    cost_type           VARCHAR(50) NOT NULL,
    amount              NUMERIC(12,2),
    currency            VARCHAR(3) DEFAULT 'HKD',
    year                INTEGER NOT NULL,              -- Academic year start (e.g., 2025 for 2025-2026)
    source              VARCHAR(50),                   -- school_website / chsc / parent_report / manual
    confidence          REAL DEFAULT 0.5 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    evidence_url        TEXT,
    notes               TEXT,
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, cost_type, year, source)  -- No duplicate fee entries
);

CREATE INDEX IF NOT EXISTS idx_cost_profile_school
    ON memory.school_cost_profile(school_master_id);

CREATE INDEX IF NOT EXISTS idx_cost_profile_year
    ON memory.school_cost_profile(year);

CREATE INDEX IF NOT EXISTS idx_cost_profile_type
    ON memory.school_cost_profile(cost_type);


-- =========================================================================
-- 3. SCHOOL ENTITY MAPPING TABLE
--    Cross-source entity mapping: EDB school_no ↔ CHSC school_id ↔ HKET school_name
--    Enables entity resolution across multiple data sources
--
--    Source systems: CHSC / HKET / KGP / MANUAL
--    Match methods: exact_alias / identity_map / fuzzy / manual
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_entity_mapping (
    id                  SERIAL PRIMARY KEY,
    school_master_id    INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    source_system       VARCHAR(50) NOT NULL,          -- CHSC / HKET / KGP / MANUAL
    source_school_id    VARCHAR(100),                  -- e.g., "SCH-00166" (CHSC), "123456" (EDB)
    source_school_name  TEXT,                          -- Name as it appears in source
    confidence          REAL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    match_method        VARCHAR(50),                   -- exact_alias / identity_map / fuzzy / manual
    verified            BOOLEAN DEFAULT FALSE,         -- Manual verification flag
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, source_system, source_school_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_mapping_master
    ON memory.school_entity_mapping(school_master_id);

CREATE INDEX IF NOT EXISTS idx_entity_mapping_source
    ON memory.school_entity_mapping(source_system, source_school_id);

CREATE INDEX IF NOT EXISTS idx_entity_mapping_verified
    ON memory.school_entity_mapping(verified)
    WHERE verified = FALSE;


-- =========================================================================
-- 4. HELPER FUNCTION: Upsert school entity master
--    Returns the master id (existing or new)
-- =========================================================================
CREATE OR REPLACE FUNCTION memory.upsert_school_master(
    p_edb_school_no     VARCHAR(20),
    p_school_name_en    TEXT,
    p_school_name_zh    TEXT,
    p_school_level      VARCHAR(50),
    p_district          VARCHAR(100),
    p_district_code     VARCHAR(20),
    p_address_en        TEXT,
    p_address_zh        TEXT,
    p_latitude          REAL,
    p_longitude         REAL,
    p_finance_type      VARCHAR(50),
    p_religion          VARCHAR(100),
    p_website           TEXT,
    p_phone             VARCHAR(50),
    p_email             TEXT,
    p_source            VARCHAR(50),
    p_source_version    VARCHAR(50)
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    -- Try update by edb_school_no first (if provided)
    IF p_edb_school_no IS NOT NULL THEN
        UPDATE memory.school_entity_master SET
            school_name_en = p_school_name_en,
            school_name_zh = COALESCE(school_name_zh, p_school_name_zh),
            school_level = COALESCE(school_level, p_school_level),
            district = COALESCE(district, p_district),
            district_code = COALESCE(district_code, p_district_code),
            address_en = COALESCE(address_en, p_address_en),
            address_zh = COALESCE(address_zh, p_address_zh),
            latitude = COALESCE(latitude, p_latitude),
            longitude = COALESCE(longitude, p_longitude),
            finance_type = COALESCE(finance_type, p_finance_type),
            religion = COALESCE(religion, p_religion),
            website = COALESCE(website, p_website),
            phone = COALESCE(phone, p_phone),
            email = COALESCE(email, p_email),
            source_version = p_source_version,
            updated_at = NOW()
        WHERE edb_school_no = p_edb_school_no
        RETURNING id INTO v_id;

        IF v_id IS NOT NULL THEN
            RETURN v_id;
        END IF;

        -- Not found by edb_school_no, try insert
        INSERT INTO memory.school_entity_master (
            edb_school_no, school_name_en, school_name_zh, school_level,
            district, district_code, address_en, address_zh,
            latitude, longitude, finance_type, religion, website,
            phone, email, source, source_version
        ) VALUES (
            p_edb_school_no, p_school_name_en, p_school_name_zh, p_school_level,
            p_district, p_district_code, p_address_en, p_address_zh,
            p_latitude, p_longitude, p_finance_type, p_religion, p_website,
            p_phone, p_email, p_source, p_source_version
        )
        ON CONFLICT (edb_school_no) DO UPDATE SET
            updated_at = NOW()
        RETURNING id INTO v_id;

        RETURN v_id;
    END IF;

    -- No edb_school_no — insert new record
    INSERT INTO memory.school_entity_master (
        edb_school_no, school_name_en, school_name_zh, school_level,
        district, district_code, address_en, address_zh,
        latitude, longitude, finance_type, religion, website,
        phone, email, source, source_version
    ) VALUES (
        NULL, p_school_name_en, p_school_name_zh, p_school_level,
        p_district, p_district_code, p_address_en, p_address_zh,
        p_latitude, p_longitude, p_finance_type, p_religion, p_website,
        p_phone, p_email, p_source, p_source_version
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;


-- =========================================================================
-- 5. HELPER FUNCTION: Upsert entity mapping
--    Records cross-source mapping with conflict handling
-- =========================================================================
CREATE OR REPLACE FUNCTION memory.upsert_entity_mapping(
    p_school_master_id  INTEGER,
    p_source_system     VARCHAR(50),
    p_source_school_id  VARCHAR(100),
    p_source_school_name TEXT,
    p_confidence        REAL,
    p_match_method      VARCHAR(50),
    p_verified          BOOLEAN
) RETURNS VOID AS $$
BEGIN
    INSERT INTO memory.school_entity_mapping (
        school_master_id, source_system, source_school_id,
        source_school_name, confidence, match_method, verified
    ) VALUES (
        p_school_master_id, p_source_system, p_source_school_id,
        p_source_school_name, p_confidence, p_match_method, p_verified
    )
    ON CONFLICT (school_master_id, source_system, source_school_id) DO UPDATE SET
        source_school_name = EXCLUDED.source_school_name,
        confidence = EXCLUDED.confidence,
        match_method = EXCLUDED.match_method,
        verified = EXCLUDED.verified,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- =========================================================================
-- 6. HELPER FUNCTION: Upsert cost profile
--    Records time-sensitive fee data with conflict handling
-- =========================================================================
CREATE OR REPLACE FUNCTION memory.upsert_cost_profile(
    p_school_master_id  INTEGER,
    p_cost_type         VARCHAR(50),
    p_amount            NUMERIC(12,2),
    p_currency          VARCHAR(3),
    p_year              INTEGER,
    p_source            VARCHAR(50),
    p_confidence        REAL,
    p_evidence_url      TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO memory.school_cost_profile (
        school_master_id, cost_type, amount, currency,
        year, source, confidence, evidence_url
    ) VALUES (
        p_school_master_id, p_cost_type, p_amount, p_currency,
        p_year, p_source, p_confidence, p_evidence_url
    )
    ON CONFLICT (school_master_id, cost_type, year, source) DO UPDATE SET
        amount = EXCLUDED.amount,
        confidence = EXCLUDED.confidence,
        evidence_url = EXCLUDED.evidence_url,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- =========================================================================
-- 7. VERIFY: Show new tables and their row counts
-- =========================================================================
SELECT 'school_entity_master' AS table_name, COUNT(*) AS row_count
FROM memory.school_entity_master
UNION ALL
SELECT 'school_cost_profile', COUNT(*)
FROM memory.school_cost_profile
UNION ALL
SELECT 'school_entity_mapping', COUNT(*)
FROM memory.school_entity_mapping;
