-- Hermes Education Schema v1.0
-- Phase 8.1: Education Data Schema + Raw Storage
-- Run: psql -U hermes -d hermes -f 001_education_schema.sql

CREATE SCHEMA IF NOT EXISTS education;

-- ============================================================
-- Core School Entity (canonical record)
-- ============================================================
CREATE TABLE IF NOT EXISTS education.schools (
    school_id TEXT PRIMARY KEY,
    canonical_name_en TEXT NOT NULL,
    canonical_name_zh TEXT NOT NULL,
    school_type TEXT NOT NULL,              -- government, aided, dss, private, international
    school_level TEXT NOT NULL,             -- kindergarten, primary, secondary
    gender TEXT NOT NULL DEFAULT 'co_ed',   -- co_ed, boys_only, girls_only
    year_established INTEGER,
    status TEXT DEFAULT 'active',           -- active, closed, merged
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Entity Resolution (alias → canonical)
-- ============================================================
CREATE TABLE IF NOT EXISTS education.school_aliases (
    id SERIAL PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES education.schools(school_id),
    alias_name TEXT NOT NULL,
    alias_lang TEXT DEFAULT 'en',           -- en, zh
    source TEXT,                            -- where this alias came from
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (alias_name, alias_lang)
);
CREATE INDEX IF NOT EXISTS idx_aliases_school ON education.school_aliases(school_id);
CREATE INDEX IF NOT EXISTS idx_aliases_name ON education.school_aliases(alias_name);

-- ============================================================
-- Structured School Facts (one-to-one with schools)
-- ============================================================
CREATE TABLE IF NOT EXISTS education.school_details (
    school_id TEXT PRIMARY KEY REFERENCES education.schools(school_id),
    -- Location
    district TEXT,
    sub_district TEXT,
    address_en TEXT,
    address_zh TEXT,
    latitude REAL,
    longitude REAL,
    -- Academics
    band TEXT,                              -- Band 1A, 1B, 1C, 2A, 2B, 2C, 3A, 3B, 3C
    language_medium TEXT,                   -- chinese, english, bilingual
    religious_affiliation TEXT,
    -- Contact
    phone TEXT,
    email TEXT,
    website TEXT,
    -- Facilities
    has_library BOOLEAN DEFAULT false,
    has_laboratory BOOLEAN DEFAULT false,
    has_sports_ground BOOLEAN DEFAULT false,
    has_swimming_pool BOOLEAN DEFAULT false,
    has_music_room BOOLEAN DEFAULT false,
    has_computer_room BOOLEAN DEFAULT false,
    -- Sources
    data_source TEXT,
    data_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Fee Structure
-- ============================================================
CREATE TABLE IF NOT EXISTS education.school_fees (
    id SERIAL PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES education.schools(school_id),
    academic_year TEXT NOT NULL,            -- 2025-26
    level TEXT NOT NULL,                    -- primary, secondary
    annual_fee REAL,                        -- HKD
    monthly_fee REAL,                       -- HKD
    has_fee_remission BOOLEAN DEFAULT false,
    fee_source TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (school_id, academic_year, level)
);
CREATE INDEX IF NOT EXISTS idx_fees_school ON education.school_fees(school_id);

-- ============================================================
-- External Rankings
-- ============================================================
CREATE TABLE IF NOT EXISTS education.school_rankings (
    id SERIAL PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES education.schools(school_id),
    ranking_source TEXT NOT NULL,           -- CHSC, HKET, etc.
    ranking_year INTEGER,
    ranking_category TEXT,                  -- academic, sports, music, overall
    rank_position INTEGER,
    rank_score REAL,
    rank_detail JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (school_id, ranking_source, ranking_year, ranking_category)
);
CREATE INDEX IF NOT EXISTS idx_rankings_school ON education.school_rankings(school_id);

-- ============================================================
-- Admission Criteria
-- ============================================================
CREATE TABLE IF NOT EXISTS education.school_admissions (
    id SERIAL PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES education.schools(school_id),
    academic_year TEXT NOT NULL,
    level TEXT NOT NULL,
    total_places INTEGER,
    open_places INTEGER,
    admission_criteria JSONB DEFAULT '{}',
    interview_required BOOLEAN,
    priority_siblings BOOLEAN DEFAULT false,
    priority_alumni BOOLEAN DEFAULT false,
    priority_religion BOOLEAN DEFAULT false,
    data_source TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (school_id, academic_year, level)
);
CREATE INDEX IF NOT EXISTS idx_admissions_school ON education.school_admissions(school_id);

-- ============================================================
-- Ranking Configuration (per-domain, per-version)
-- ============================================================
CREATE TABLE IF NOT EXISTS education.ranking_config (
    id SERIAL PRIMARY KEY,
    domain TEXT NOT NULL DEFAULT 'education',
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    weights JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (domain, version)
);

-- Default ranking config
INSERT INTO education.ranking_config (domain, version, name, description, weights, is_active)
VALUES ('education', 'v1', 'Default Balanced', 'Default balanced ranking: constraint 0.5, fit 0.3, evidence 0.2',
        '{"constraint": 0.5, "fit": 0.3, "evidence": 0.2}', true)
ON CONFLICT (domain, version) DO NOTHING;

-- ============================================================
-- Evidence Trace (provenance for every recommendation factor)
-- ============================================================
CREATE TABLE IF NOT EXISTS education.evidence_sources (
    source_id TEXT PRIMARY KEY,             -- e.g., EDB, CHSC, KGP, HKET
    source_name TEXT NOT NULL,
    source_type TEXT NOT NULL,              -- government, ranking_body, media, parent_forum
    credibility_score REAL DEFAULT 5.0,     -- 1-10, higher = more credible
    url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO education.evidence_sources (source_id, source_name, source_type, credibility_score, description)
VALUES
    ('EDB', 'Education Bureau', 'government', 9.0, 'Official HK government education data'),
    ('CHSC', 'Committee on Home-School Co-operation', 'government', 8.0, 'School profiles and statistics'),
    ('KGP', 'Kindergarten Profile', 'government', 8.0, 'Official kindergarten profiles from EDB'),
    ('HKET', 'HK Economic Times', 'media', 5.0, 'School news and parent guides'),
    ('data_gov_hk', 'data.gov.hk', 'government', 9.0, 'Open government data portal')
ON CONFLICT (source_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS education.evidence_items (
    id SERIAL PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES education.schools(school_id),
    source_id TEXT NOT NULL REFERENCES education.evidence_sources(source_id),
    factor TEXT NOT NULL,                   -- district, band, fee, language, curriculum, etc.
    factor_value TEXT NOT NULL,
    evidence_text TEXT,
    evidence_url TEXT,
    retrieved_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evidence_school ON education.evidence_items(school_id);
CREATE INDEX IF NOT EXISTS idx_evidence_factor ON education.evidence_items(school_id, factor);

-- ============================================================
-- Feedback Loop (for ranking weight optimization)
-- ============================================================
CREATE TABLE IF NOT EXISTS education.decision_feedback (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    recommendation_id TEXT,
    school_id TEXT REFERENCES education.schools(school_id),
    feedback_type TEXT NOT NULL,            -- accepted, rejected, saved, ignored
    feedback_reason TEXT,
    context JSONB DEFAULT '{}',             -- snapshot of family/child profile at decision time
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON education.decision_feedback(user_id);
