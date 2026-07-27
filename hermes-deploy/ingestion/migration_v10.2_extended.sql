-- =========================================================================
-- Phase 10.2 (Extended): Education Data Foundation Layer
-- Layers 2-5: Admission Structure, Relationship Graph, Profile Evidence, Availability
--
-- This migration extends Phase 10.2.1 (school_entity_master) with 4 additional layers.
--
-- Layers:
--   Layer 2 — Admission Structure (升學制度層): SSPA + POA school nets
--   Layer 3 — School Relationship Graph (關係層): Through-train schools
--   Layer 4 — School Intelligence Profile (學校情報層): SSP/PSP/KGP profiles
--   Layer 5 — Availability / Market Signal (供應信號): K1-K3 vacancy
--
-- IMPORTANT: This migration is IDEMPOTIENT — safe to run multiple times.
-- =========================================================================


-- =========================================================================
-- LAYER 2 — ADMISSION STRUCTURE (升學制度層)
-- =========================================================================

-- 2A. Secondary School Serving Net (中學學位分配辦法學校網資料)
--     Maps which primary school nets feed into each secondary school
--
--     CSV Structure: Net, DIST, Sch Code, SCH_NAME, HK1, HK2, ..., NT9
--     Each row = one secondary school
--     HK1-NT9 columns = boolean (Y/N) indicating which primary nets serve this school
--
--     This is CRITICAL for HK secondary admission:
--       Home Address → Primary Net → Secondary Net → Applicable Schools
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_sspa_serving (
    id                  SERIAL PRIMARY KEY,
    school_master_id    INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    secondary_net       VARCHAR(10) NOT NULL,        -- e.g., "HK1", "KL2", "NT5"
    primary_net         VARCHAR(10) NOT NULL,        -- e.g., "HK1", "HK2", "NT5"
    is_serving          BOOLEAN DEFAULT TRUE,        -- Y = serves this net, N = does not
    source              VARCHAR(50) DEFAULT 'EDB_SSPA',
    source_version      VARCHAR(50),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, secondary_net, primary_net)
);

CREATE INDEX IF NOT EXISTS idx_sspa_serving_master
    ON memory.school_sspa_serving(school_master_id);

CREATE INDEX IF NOT EXISTS idx_sspa_serving_secondary_net
    ON memory.school_sspa_serving(secondary_net);

CREATE INDEX IF NOT EXISTS idx_sspa_serving_primary_net
    ON memory.school_sspa_serving(primary_net);


-- 2B. Primary School Net (小一入學統籌辦法學校網範圍)
--     Maps geographic areas to primary school nets
--
--     CSV Structure: SCHOOLNET, AREA, WEBPAGE
--     Each row = one primary school net with its geographic coverage
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_poa_net (
    id                  SERIAL PRIMARY KEY,
    net_number          VARCHAR(10) UNIQUE NOT NULL, -- e.g., "11", "95"
    areas               TEXT,                        -- Comma-separated areas
    webpage             TEXT,
    source              VARCHAR(50) DEFAULT 'EDB_POA',
    source_version      VARCHAR(50),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poa_net_number
    ON memory.school_poa_net(net_number);


-- =========================================================================
-- LAYER 3 — SCHOOL RELATIONSHIP GRAPH (關係層)
-- =========================================================================

-- 3A. School Relationships (一條龍學校名單 + feeder + nominated)
--     Models through-train, feeder, and nominated school relationships
--
--     CSV Structure: GroupID, SchoolName, District, Remarks
--     Each GroupID links schools in the same through-train group
--
--     Relationship types:
--       - through_train: 一條龍 (primary → secondary direct linkage)
--       - feeder: 直屬 (feeder school relationship)
--       - nominated: 聯繫 (nominated school relationship)
--
--     Graph: Primary School ──through_train──→ Secondary School
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_relationship (
    id                  SERIAL PRIMARY KEY,
    school_master_id    INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    related_school_id   INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    relationship_type   VARCHAR(50) NOT NULL,        -- through_train / feeder / nominated
    group_id            VARCHAR(20),                 -- EDB group identifier
    remarks             TEXT,
    source              VARCHAR(50) DEFAULT 'EDB_THROUGH_TRAIN',
    source_version      VARCHAR(50),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, related_school_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_relationship_master
    ON memory.school_relationship(school_master_id);

CREATE INDEX IF NOT EXISTS idx_relationship_related
    ON memory.school_relationship(related_school_id);

CREATE INDEX IF NOT EXISTS idx_relationship_type
    ON memory.school_relationship(relationship_type);

CREATE INDEX IF NOT EXISTS idx_relationship_group
    ON memory.school_relationship(group_id);


-- =========================================================================
-- LAYER 4 — SCHOOL INTELLIGENCE PROFILE (學校情報層)
-- =========================================================================

-- 4A. School Profile Evidence (中學概覽 + 小學概覽 + 幼稚園概覽)
--     Rich school profiles for recommendation reasoning
--
--     Sources:
--       - EDB_SSP: Secondary School Profiles (中學概覽)
--       - EDB_PSP: Primary School Profiles (小學概覽)
--       - EDB_KGP: Kindergarten Profiles (幼稚園概覽)
--       - CHSC: Secondary School Profiles (existing, 441 schools)
--
--     Profile types:
--       - mission: School mission statement
--       - curriculum: Curriculum information
--       - facility: Facilities available
--       - language: Language policy (medium of instruction)
--       - activity: Extracurricular activities
--       - history: School history (founded year, motto)
--       - organization: Sponsoring body, PTA, student union
--
--     Note: This is NOT the same as school_entity_master.
--           Master = identity (name, address, coordinates)
--           Profile = intelligence (mission, curriculum, language policy)
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_profile_evidence (
    id                      SERIAL PRIMARY KEY,
    school_master_id        INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    profile_type            VARCHAR(20),        -- mission / curriculum / facility / language / activity / history / organization
    profile_key             VARCHAR(100),       -- e.g., "school_mission", "medium_of_instruction"
    profile_value           TEXT,
    source                  VARCHAR(50),        -- EDB_SSP / EDB_PSP / EDB_KGP / CHSC
    source_version          VARCHAR(50),
    confidence              REAL DEFAULT 0.9 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, profile_type, profile_key, source)
);

CREATE INDEX IF NOT EXISTS idx_profile_master
    ON memory.school_profile_evidence(school_master_id);

CREATE INDEX IF NOT EXISTS idx_profile_type
    ON memory.school_profile_evidence(profile_type);

CREATE INDEX IF NOT EXISTS idx_profile_key
    ON memory.school_profile_evidence(profile_key);

CREATE INDEX IF NOT EXISTS idx_profile_source
    ON memory.school_profile_evidence(source);


-- =========================================================================
-- LAYER 5 — AVAILABILITY / MARKET SIGNAL (供應信號)
-- =========================================================================

-- 5A. School Availability (幼稚園 K1-K3 學位空缺資料)
--     Time-sensitive vacancy data — market signal for kindergarten admission
--
--     CSV Structure: District, SCRN, School English Name, School Chinese Name,
--                    K1 Vacancy Status, K2 Vacancy Status, K3 Vacancy Status, As At Date
--
--     Vacancy status: Y (vacancy) / N (no vacancy) / L (limited)
--
--     IMPORTANT: This is TIME-SENSITIVE data.
--                Never merge into school_entity_master.
--                Always query with snapshot_date.
--
--     Use case: "邊間幼稚園 K1 仲有位？" (Which KGs still have K1 vacancies?)
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_availability (
    id                      SERIAL PRIMARY KEY,
    school_master_id        INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    level                   VARCHAR(10) NOT NULL,        -- K1 / K2 / K3
    vacancy_status          VARCHAR(10),                 -- Y / N / L (limited)
    snapshot_date           DATE NOT NULL,               -- When this data was captured
    source                  VARCHAR(50) DEFAULT 'EDB_KG_VACANCY',
    source_version          VARCHAR(50),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, level, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_availability_master
    ON memory.school_availability(school_master_id);

CREATE INDEX IF NOT EXISTS idx_availability_level
    ON memory.school_availability(level);

CREATE INDEX IF NOT EXISTS idx_availability_snapshot
    ON memory.school_availability(snapshot_date);

CREATE INDEX IF NOT EXISTS idx_availability_status
    ON memory.school_availability(vacancy_status);

-- Composite index for common query: "K1 vacancies as of date X"
CREATE INDEX IF NOT EXISTS idx_availability_level_date
    ON memory.school_availability(level, snapshot_date);


-- =========================================================================
-- HELPER FUNCTIONS
-- =========================================================================

-- Upsert SSPA serving record
CREATE OR REPLACE FUNCTION memory.upsert_sspa_serving(
    p_school_master_id  INTEGER,
    p_secondary_net     VARCHAR(10),
    p_primary_net       VARCHAR(10),
    p_is_serving        BOOLEAN,
    p_source            VARCHAR(50),
    p_source_version    VARCHAR(50)
) RETURNS VOID AS $$
BEGIN
    INSERT INTO memory.school_sspa_serving (
        school_master_id, secondary_net, primary_net, is_serving, source, source_version
    ) VALUES (
        p_school_master_id, p_secondary_net, p_primary_net, p_is_serving, p_source, p_source_version
    )
    ON CONFLICT (school_master_id, secondary_net, primary_net) DO UPDATE SET
        is_serving = EXCLUDED.is_serving,
        source_version = EXCLUDED.source_version,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- Upsert school relationship
CREATE OR REPLACE FUNCTION memory.upsert_school_relationship(
    p_school_master_id  INTEGER,
    p_related_school_id INTEGER,
    p_relationship_type VARCHAR(50),
    p_group_id          VARCHAR(20),
    p_remarks           TEXT,
    p_source            VARCHAR(50),
    p_source_version    VARCHAR(50)
) RETURNS VOID AS $$
BEGIN
    INSERT INTO memory.school_relationship (
        school_master_id, related_school_id, relationship_type,
        group_id, remarks, source, source_version
    ) VALUES (
        p_school_master_id, p_related_school_id, p_relationship_type,
        p_group_id, p_remarks, p_source, p_source_version
    )
    ON CONFLICT (school_master_id, related_school_id, relationship_type) DO UPDATE SET
        group_id = EXCLUDED.group_id,
        remarks = EXCLUDED.remarks,
        source_version = EXCLUDED.source_version,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- Upsert profile evidence
CREATE OR REPLACE FUNCTION memory.upsert_profile_evidence(
    p_school_master_id  INTEGER,
    p_profile_type      VARCHAR(20),
    p_profile_key       VARCHAR(100),
    p_profile_value     TEXT,
    p_source            VARCHAR(50),
    p_source_version    VARCHAR(50),
    p_confidence        REAL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO memory.school_profile_evidence (
        school_master_id, profile_type, profile_key, profile_value,
        source, source_version, confidence
    ) VALUES (
        p_school_master_id, p_profile_type, p_profile_key, p_profile_value,
        p_source, p_source_version, p_confidence
    )
    ON CONFLICT (school_master_id, profile_type, profile_key, source) DO UPDATE SET
        profile_value = EXCLUDED.profile_value,
        confidence = EXCLUDED.confidence,
        source_version = EXCLUDED.source_version,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- Upsert availability record
CREATE OR REPLACE FUNCTION memory.upsert_availability(
    p_school_master_id  INTEGER,
    p_level             VARCHAR(10),
    p_vacancy_status    VARCHAR(10),
    p_snapshot_date     DATE,
    p_source            VARCHAR(50),
    p_source_version    VARCHAR(50)
) RETURNS VOID AS $$
BEGIN
    INSERT INTO memory.school_availability (
        school_master_id, level, vacancy_status, snapshot_date, source, source_version
    ) VALUES (
        p_school_master_id, p_level, p_vacancy_status, p_snapshot_date, p_source, p_source_version
    )
    ON CONFLICT (school_master_id, level, snapshot_date) DO UPDATE SET
        vacancy_status = EXCLUDED.vacancy_status,
        source_version = EXCLUDED.source_version,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- =========================================================================
-- VERIFY: Show all Phase 10.2 tables and their row counts
-- =========================================================================
SELECT 'school_entity_master' AS table_name, COUNT(*) AS row_count FROM memory.school_entity_master
UNION ALL
SELECT 'school_cost_profile', COUNT(*) FROM memory.school_cost_profile
UNION ALL
SELECT 'school_entity_mapping', COUNT(*) FROM memory.school_entity_mapping
UNION ALL
SELECT 'school_sspa_serving', COUNT(*) FROM memory.school_sspa_serving
UNION ALL
SELECT 'school_poa_net', COUNT(*) FROM memory.school_poa_net
UNION ALL
SELECT 'school_relationship', COUNT(*) FROM memory.school_relationship
UNION ALL
SELECT 'school_profile_evidence', COUNT(*) FROM memory.school_profile_evidence
UNION ALL
SELECT 'school_availability', COUNT(*) FROM memory.school_availability;