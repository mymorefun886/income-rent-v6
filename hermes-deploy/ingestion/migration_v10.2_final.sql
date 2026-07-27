-- =========================================================================
-- Phase 10.2: Education Data Foundation Layer — ARCHITECTURE FREEZE v1.2.0
--
-- Status: FROZEN (2026-07-27)
-- Architecture Score: 9.5/10
--
-- This migration is the final schema definition for Phase 10.2.
-- No further schema additions should be made in this phase.
-- Next phase: Phase 10.3 — Education Intelligence Runtime Validation
--
-- Layers:
--   Layer 1 — School Entity Master (身份層)
--   Layer 1b — School Alias (雙語別名)
--   Layer 1c — Evidence Document (原始文件管理)
--   Layer 1d — Evidence Chunk (RAG 碎片)
--   Layer 2 — Admission Structure (升學制度層)
--   Layer 3 — School Relationship Graph (關係層)
--   Layer 4 — School Intelligence Profile (學校情報層)
--   Layer 5 — Availability / Market Signal (供應信號)
--   Layer 6 — Cost Intelligence + Decision Evidence (成本情報 + 決策證據)
--
-- Key Design Decisions:
--   - Bilingual support: language field in evidence tables (not separate datasets)
--   - Entity Resolution: multi-stage (school_no → ZH name → EN name → alias → fuzzy)
--   - Temporal data: network_year, effective_year, snapshot_date
--   - Confidence scoring: relationship confidence_score, match confidence
--   - Document pipeline: evidence_document → evidence_chunk → embedding
--   - Decision trace: decision_evidence with decision_id grouping
-- =========================================================================


-- =========================================================================
-- LAYER 1 — SCHOOL ENTITY MASTER (身份層)
-- =========================================================================
-- Already created in migration_v10.2_school_master.sql
-- Tables: school_entity_master, school_entity_mapping
-- Note: school_cost_profile MOVED to Layer 6

-- 1B. School Alias (雙語別名)
--     Purpose: Entity Resolution for bilingual queries.
--              Parents may search: "King's College", "英皇書院", "KC"
--              All must resolve to the same entity.
--
--     Alias types:
--       - official: Official name variant (e.g., "King's College" is official EN name)
--       - short: Abbreviation (e.g., "KC", "DBS", "LaSalle")
--       - common: Common usage (e.g., "英皇" for 英皇書院)
--       - former: Former name (e.g., "Queen's College" was formerly "Central School")
--
--     Language codes: zh-HK (Hong Kong Chinese), en (English)
--
--     normalized_alias: Lowercase, punctuation-stripped version for search.
--       Example: "King's College" → "kings college"
--                "KING'S COLLEGE" → "kings college"
--       This enables case-insensitive exact lookup and better trigram matching.
--
--     Examples:
--       school_id=1, alias="英皇書院", normalized_alias="英皇書院", language="zh-HK", type="official"
--       school_id=1, alias="King's College", normalized_alias="kings college", language="en", type="official"
--       school_id=1, alias="KC", normalized_alias="kc", language="en", type="short"
--       school_id=1, alias="英皇", normalized_alias="英皇", language="zh-HK", type="common"
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_alias (
    id                  SERIAL PRIMARY KEY,
    school_master_id    INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    alias               TEXT NOT NULL,                -- The alias text (original casing)
    normalized_alias    TEXT NOT NULL,               -- Lowercase, punctuation-stripped for search
    language            VARCHAR(10) NOT NULL,         -- zh-HK / en / zh-CN
    alias_type          VARCHAR(20) NOT NULL,         -- official / short / common / former
    source              VARCHAR(50) DEFAULT 'EDB',   -- EDB / CHSC / MANUAL
    confidence          REAL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, alias, language, alias_type)
);

CREATE INDEX IF NOT EXISTS idx_school_alias_master
    ON memory.school_alias(school_master_id);

CREATE INDEX IF NOT EXISTS idx_school_alias_alias
    ON memory.school_alias(alias);

CREATE INDEX IF NOT EXISTS idx_school_alias_normalized
    ON memory.school_alias(normalized_alias);

CREATE INDEX IF NOT EXISTS idx_school_alias_language
    ON memory.school_alias(language);

CREATE INDEX IF NOT EXISTS idx_school_alias_type
    ON memory.school_alias(alias_type);

-- Trigram index for fuzzy alias matching (on normalized form)
CREATE INDEX IF NOT EXISTS idx_school_alias_trgm
    ON memory.school_alias USING gin(normalized_alias gin_trgm_ops);


-- =========================================================================
-- LAYER 1c — EVIDENCE DOCUMENT (原始文件管理)
-- =========================================================================
-- Purpose: Track original PDF/CSV documents from EDB.
--          Separates document management from structured data.
--
-- Pipeline:
--   PDF → OCR/Text Extract → Language Detection → Structure Parser → Evidence Chunk → Embedding
--
-- Document types:
--   - school_location: 學校位置及資料
--   - school_registration: 學校註冊資料
--   - sspa_net: 中學學位分配學校網資料
--   - through_train: 「一條龍」學校名單
--   - poa_net: 小一入學統籌辦法學校網範圍
--   - secondary_overview: 中學概覽
--   - primary_overview: 小學概覽
--   - kg_overview: 幼稚園及幼稚園暨幼兒中心概覽
--   - kg_vacancy: 幼稚園幼兒班至高班學位空缺資料
--
-- Language codes: zh-HK (Hong Kong Chinese), en (English)
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.evidence_document (
    id                  SERIAL PRIMARY KEY,
    source              VARCHAR(50) NOT NULL,        -- EDB / CHSC / HKET / KGP
    document_type       VARCHAR(50) NOT NULL,        -- school_location / school_registration / sspa_net / etc.
    title               TEXT NOT NULL,               -- Document title
    language            VARCHAR(10) NOT NULL,         -- zh-HK / en
    file_path           TEXT,                        -- Local file path
    file_hash           VARCHAR(64),                 -- SHA-256 for dedup
    file_size_bytes     INTEGER,
    url                 TEXT,                        -- Source URL
    published_date      DATE,                        -- When document was published
    refresh_cycle       VARCHAR(20),                 -- annual / monthly / one_time
    metadata            JSONB,                       -- Additional metadata
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source, document_type, language, file_hash)
);

CREATE INDEX IF NOT EXISTS idx_evidence_document_source
    ON memory.evidence_document(source);

CREATE INDEX IF NOT EXISTS idx_evidence_document_type
    ON memory.evidence_document(document_type);

CREATE INDEX IF NOT EXISTS idx_evidence_document_language
    ON memory.evidence_document(language);

CREATE INDEX IF NOT EXISTS idx_evidence_document_published
    ON memory.evidence_document(published_date);


-- =========================================================================
-- LAYER 1d — EVIDENCE CHUNK (RAG 碎片)
-- =========================================================================
-- Purpose: Store RAG chunks for embedding and retrieval.
--          Separates raw document storage from vector search.
--
-- Each chunk references:
--   - evidence_document: The source document
--   - school_entity_master: The school this chunk is about (if applicable)
--
-- Chunk metadata:
--   - page_number: Page in original PDF
--   - section: Section heading (e.g., "School Characteristics", "School Management")
--   - chunk_index: Sequential index within document
--
-- Embedding storage:
--   - embedding_id: Reference to Qdrant point ID (UUID)
--   - embedding_model: Model used for embedding (e.g., "text-embedding-3-large")
--
-- Language value by dataset (for prioritization):
--   - school_location: zh-HK = en (both equally important for entity)
--   - school_overview: zh-HK = en (both equally important for RAG)
--   - school_net: zh-HK > en (Chinese more important for parents)
--   - through_train: zh-HK > en
--   - kg_vacancy: zh-HK >> en (Chinese critical for real-time queries)
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.evidence_chunk (
    id                  SERIAL PRIMARY KEY,
    document_id         INTEGER REFERENCES memory.evidence_document(id) ON DELETE CASCADE,
    school_master_id    INTEGER REFERENCES memory.school_entity_master(id) ON DELETE SET NULL,
    content             TEXT NOT NULL,               -- Chunk text content
    language            VARCHAR(10) NOT NULL,         -- zh-HK / en
    page_number         INTEGER,                     -- Page in original PDF
    section             TEXT,                        -- Section heading
    chunk_index         INTEGER NOT NULL,            -- Sequential index within document
    token_count         INTEGER,                     -- Approximate token count
    embedding_id        UUID,                        -- Reference to Qdrant point ID
    embedding_model     VARCHAR(50),                 -- e.g., "text-embedding-3-large"
    metadata            JSONB,                       -- Additional metadata
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, chunk_index, language)
);

CREATE INDEX IF NOT EXISTS idx_evidence_chunk_document
    ON memory.evidence_chunk(document_id);

CREATE INDEX IF NOT EXISTS idx_evidence_chunk_school
    ON memory.evidence_chunk(school_master_id);

CREATE INDEX IF NOT EXISTS idx_evidence_chunk_language
    ON memory.evidence_chunk(language);

CREATE INDEX IF NOT EXISTS idx_evidence_chunk_embedding
    ON memory.evidence_chunk(embedding_id);


-- =========================================================================
-- LAYER 2 — ADMISSION STRUCTURE (升學制度層)
-- =========================================================================

-- 2A. Secondary School Network (中學學位分配辦法學校網)
--     Renamed from school_sspa_serving → school_secondary_network
--     Rationale: "serving" is too narrow. This table models the entire
--                secondary school net structure, not just serving relationships.
--
--     Future expansion: 自行分配學位, 統一派位, Band allocation, Choice priority
--
--     network_year: HK school nets may adjust annually.
--                   Example: Net 41 may change coverage in 2026 vs 2025.
--                   This prevents overwriting historical data.
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_secondary_network (
    id                  SERIAL PRIMARY KEY,
    school_master_id    INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    secondary_net       VARCHAR(10) NOT NULL,        -- e.g., "HK1", "KL2", "NT5"
    primary_net         VARCHAR(10) NOT NULL,        -- e.g., "HK1", "HK2", "NT5"
    is_serving          BOOLEAN DEFAULT TRUE,        -- Y = serves this net, N = does not
    allocation_phase    VARCHAR(20),                 -- discretionary / central / future expansion
    network_year        INTEGER NOT NULL,            -- Year this net configuration is valid (e.g., 2026)
    source              VARCHAR(50) DEFAULT 'EDB_SSPA',
    source_version      VARCHAR(50),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, secondary_net, primary_net, network_year)
);

CREATE INDEX IF NOT EXISTS idx_secondary_network_master
    ON memory.school_secondary_network(school_master_id);

CREATE INDEX IF NOT EXISTS idx_secondary_network_secondary_net
    ON memory.school_secondary_network(secondary_net);

CREATE INDEX IF NOT EXISTS idx_secondary_network_primary_net
    ON memory.school_secondary_network(primary_net);

CREATE INDEX IF NOT EXISTS idx_secondary_network_year
    ON memory.school_secondary_network(network_year);


-- 2B. Primary School Net (小一入學統籌辦法學校網範圍)
--     Maps geographic areas to primary school nets
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_primary_network (
    id                  SERIAL PRIMARY KEY,
    net_number          VARCHAR(10) UNIQUE NOT NULL, -- e.g., "11", "95"
    areas               TEXT,                        -- Comma-separated areas
    district            VARCHAR(100),                -- Derived district
    webpage             TEXT,
    source              VARCHAR(50) DEFAULT 'EDB_POA',
    source_version      VARCHAR(50),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_primary_network_net_number
    ON memory.school_primary_network(net_number);

CREATE INDEX IF NOT EXISTS idx_primary_network_district
    ON memory.school_primary_network(district);


-- =========================================================================
-- LAYER 3 — SCHOOL RELATIONSHIP GRAPH (關係層)
-- =========================================================================

-- 3A. School Relationships (一條龍 + 直屬 + 聯繫 + 同機構)
--     Expanded relationship types for Graph RAG
--
--     Relationship types:
--       - through_train: 一條龍 (primary → secondary direct linkage)
--       - feeder: 直屬 (feeder school relationship)
--       - nominated: 聯繫 (nominated school relationship)
--       - affiliated: 同一辦學團體 (same sponsoring organization)
--       - same_organization: 同一機構 (same organization group)
--       - sister_school: 姊妹學校 (sister school relationship)
--
--     effective_year: When this relationship became effective (for temporal queries)
--
--     confidence_score: Not all relationships are equally reliable.
--       - EDB official: 1.0
--       - News report: 0.7
--       - Parent data: 0.4
--
--     Graph traversal examples:
--       - "某幼稚園升哪間小學？" → through_train / feeder
--       - "讀這條龍小學有什麼優勢？" → through_train to secondary
--       - "邊間小學係某中學嘅直屬？" → feeder relationship
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_relationship (
    id                  SERIAL PRIMARY KEY,
    source_school_id    INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    target_school_id    INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    relationship_type   VARCHAR(50) NOT NULL,
        -- through_train / feeder / nominated / affiliated / same_organization / sister_school
    relationship_detail TEXT,                        -- Additional details
    group_id            VARCHAR(20),                 -- EDB group identifier (for through_train)
    effective_year      INTEGER,                     -- Year relationship became effective
    expiry_year         INTEGER,                     -- Year relationship expired (if applicable)
    confidence_score    REAL DEFAULT 1.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    remarks             TEXT,
    source              VARCHAR(50) DEFAULT 'EDB_THROUGH_TRAIN',
    source_version      VARCHAR(50),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_school_id, target_school_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_relationship_source
    ON memory.school_relationship(source_school_id);

CREATE INDEX IF NOT EXISTS idx_relationship_target
    ON memory.school_relationship(target_school_id);

CREATE INDEX IF NOT EXISTS idx_relationship_type
    ON memory.school_relationship(relationship_type);

CREATE INDEX IF NOT EXISTS idx_relationship_group
    ON memory.school_relationship(group_id);

CREATE INDEX IF NOT EXISTS idx_relationship_effective
    ON memory.school_relationship(effective_year);


-- =========================================================================
-- LAYER 4 — SCHOOL INTELLIGENCE PROFILE (學校情報層)
-- =========================================================================

-- 4A. School Profile Evidence (中學概覽 + 小學概覽 + 幼稚園概覽)
--     Rich school profiles for recommendation reasoning
--
--     Anti-hallucination design:
--       Agent answers: "推薦原因：英文授課政策來自教育局中學概覽"
--       Traceable to: school_profile_evidence.source = "EDB_SSP"
--
--     Bilingual design:
--       EDB provides both ZH and EN versions of school overviews.
--       We store both as separate rows with language field.
--       Example:
--         Row 1: school_id=1, key=mission, language=zh-HK, value="學校致力於..."
--         Row 2: school_id=1, key=mission, language=en, value="The school aims to..."
--
--     Profile types:
--       - mission: School mission statement
--       - curriculum: Curriculum information
--       - facility: Facilities available
--       - language: Language policy (medium of instruction)
--       - activity: Extracurricular activities
--       - history: School history (founded year, motto)
--       - organization: Sponsoring body, PTA, student union
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_profile_evidence (
    id                      SERIAL PRIMARY KEY,
    school_master_id        INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    profile_type            VARCHAR(20),        -- mission / curriculum / facility / language / activity / history / organization
    profile_key             VARCHAR(100),       -- e.g., "school_mission", "medium_of_instruction"
    profile_value           TEXT,
    language                VARCHAR(10) NOT NULL DEFAULT 'zh-HK',  -- zh-HK / en
    source                  VARCHAR(50),        -- EDB_SSP / EDB_PSP / EDB_KGP / CHSC
    source_version          VARCHAR(50),
    confidence              REAL DEFAULT 0.9 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, profile_type, profile_key, source, language)
);

CREATE INDEX IF NOT EXISTS idx_profile_master
    ON memory.school_profile_evidence(school_master_id);

CREATE INDEX IF NOT EXISTS idx_profile_type
    ON memory.school_profile_evidence(profile_type);

CREATE INDEX IF NOT EXISTS idx_profile_key
    ON memory.school_profile_evidence(profile_key);

CREATE INDEX IF NOT EXISTS idx_profile_source
    ON memory.school_profile_evidence(source);

CREATE INDEX IF NOT EXISTS idx_profile_language
    ON memory.school_profile_evidence(language);


-- =========================================================================
-- LAYER 5 — AVAILABILITY / MARKET SIGNAL (供應信號)
-- =========================================================================

-- 5A. School Availability (幼稚園 K1-K3 學位空缺資料)
--     Time-sensitive vacancy data — market signal for kindergarten admission
--
--     Vacancy status: Y (vacancy) / N (no vacancy) / L (limited)
--
--     Bilingual design:
--       Vacancy data primarily used by Chinese-speaking parents.
--       But we store language for consistency with other tables.
--
--     IMPORTANT: This is TIME-SENSITIVE data.
--                Always query with snapshot_date.
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_availability (
    id                      SERIAL PRIMARY KEY,
    school_master_id        INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    level                   VARCHAR(10) NOT NULL,        -- K1 / K2 / K3
    vacancy_status          VARCHAR(10),                 -- Y / N / L (limited)
    vacancy_count           INTEGER,                     -- Optional: actual number of vacancies
    snapshot_date           DATE NOT NULL,               -- When this data was captured
    language                VARCHAR(10) NOT NULL DEFAULT 'zh-HK',  -- zh-HK / en
    source                  VARCHAR(50) DEFAULT 'EDB_KG_VACANCY',
    source_version          VARCHAR(50),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, level, snapshot_date, language)
);

CREATE INDEX IF NOT EXISTS idx_availability_master
    ON memory.school_availability(school_master_id);

CREATE INDEX IF NOT EXISTS idx_availability_level
    ON memory.school_availability(level);

CREATE INDEX IF NOT EXISTS idx_availability_snapshot
    ON memory.school_availability(snapshot_date);

CREATE INDEX IF NOT EXISTS idx_availability_status
    ON memory.school_availability(vacancy_status);

CREATE INDEX IF NOT EXISTS idx_availability_level_date
    ON memory.school_availability(level, snapshot_date);


-- =========================================================================
-- LAYER 6 — COST INTELLIGENCE + DECISION EVIDENCE (成本情報 + 決策證據)
-- =========================================================================

-- 6A. School Cost Profile (成本情報)
--     MOVED from Layer 1 — fees are NOT identity
--     Time-sensitive, source-sensitive fee data
--
--     Cost types: tuition / lunch / activity / uniform / bus / other
--     Source: school_website / chsc / parent_report / manual
--
--     Rationale for separate layer:
--       - Master identity changes rarely (yearly)
--       - Fees change yearly or more frequently
--       - Mixing them causes staleness pollution
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.school_cost_profile (
    id                  SERIAL PRIMARY KEY,
    school_master_id    INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    cost_type           VARCHAR(50) NOT NULL,          -- tuition / lunch / activity / uniform / bus / other
    amount              NUMERIC(12,2),
    currency            VARCHAR(3) DEFAULT 'HKD',
    year                INTEGER NOT NULL,              -- Academic year start (e.g., 2025 for 2025-2026)
    source              VARCHAR(50),                   -- school_website / chsc / parent_report / manual
    confidence          REAL DEFAULT 0.5 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    evidence_url        TEXT,
    notes               TEXT,
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, cost_type, year, source)
);

CREATE INDEX IF NOT EXISTS idx_cost_profile_school
    ON memory.school_cost_profile(school_master_id);

CREATE INDEX IF NOT EXISTS idx_cost_profile_year
    ON memory.school_cost_profile(year);

CREATE INDEX IF NOT EXISTS idx_cost_profile_type
    ON memory.school_cost_profile(cost_type);


-- 6B. Decision Evidence (決策證據)
--     Stores parent cases, recommendation reasoning, decision traces
--     Purpose: Hermes is a "家庭決策助手", not a search tool
--
--     Use cases:
--       - "上次推薦咗咩學校比類似背景的家庭？"
--       - "呢間學校推薦理由係咩？"
--       - "其他家長點睇呢間學校？"
--       - "為什麼不是另一間？" (counterfactual explanation)
--
--     Evidence types:
--       - parent_case: Anonymized parent decision case
--       - recommendation_reason: Why a school was recommended
--       - agent_reasoning: Agent's reasoning trace
--       - parent_feedback: Parent feedback on recommendation
--
--     Factor example:
--       {"factor": "distance", "value": "3.2km", "source": "EDB geo", "weight": 0.15}
-- =========================================================================
CREATE TABLE IF NOT EXISTS memory.decision_evidence (
    id                      SERIAL PRIMARY KEY,
    school_master_id        INTEGER REFERENCES memory.school_entity_master(id) ON DELETE CASCADE,
    decision_id             UUID NOT NULL,                   -- Groups factors for same decision
    evidence_type           VARCHAR(50) NOT NULL,
        -- parent_case / recommendation_reason / agent_reasoning / parent_feedback
    child_profile_summary   JSONB,                      -- Anonymized child profile snapshot
    factor_type             VARCHAR(100),               -- e.g., "academic_fit", "distance", "language"
    factor_value            TEXT,                       -- e.g., "Band 1", "within 2km", "EMI"
    source                  VARCHAR(50) DEFAULT 'AGENT', -- EDB / CHSC / AGENT / PARENT
    weight                  REAL,                       -- Factor weight in decision
    final_reason            TEXT,                       -- Human-readable reasoning
    parent_id               VARCHAR(64),                -- Anonymized parent identifier
    session_id              UUID,                       -- Links to recommendation_session
    confidence              REAL DEFAULT 0.5 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_evidence_school
    ON memory.decision_evidence(school_master_id);

CREATE INDEX IF NOT EXISTS idx_decision_evidence_decision
    ON memory.decision_evidence(decision_id);

CREATE INDEX IF NOT EXISTS idx_decision_evidence_type
    ON memory.decision_evidence(evidence_type);

CREATE INDEX IF NOT EXISTS idx_decision_evidence_factor
    ON memory.decision_evidence(factor_type);

CREATE INDEX IF NOT EXISTS idx_decision_evidence_parent
    ON memory.decision_evidence(parent_id);

CREATE INDEX IF NOT EXISTS idx_decision_evidence_session
    ON memory.decision_evidence(session_id);


-- =========================================================================
-- HELPER FUNCTIONS
-- =========================================================================

-- Upsert school alias
CREATE OR REPLACE FUNCTION memory.upsert_school_alias(
    p_school_master_id  INTEGER,
    p_alias             TEXT,
    p_normalized_alias  TEXT,
    p_language          VARCHAR(10),
    p_alias_type        VARCHAR(20),
    p_source            VARCHAR(50),
    p_confidence        REAL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO memory.school_alias (
        school_master_id, alias, normalized_alias, language, alias_type, source, confidence
    ) VALUES (
        p_school_master_id, p_alias, p_normalized_alias, p_language, p_alias_type, p_source, p_confidence
    )
    ON CONFLICT (school_master_id, alias, language, alias_type) DO UPDATE SET
        normalized_alias = EXCLUDED.normalized_alias,
        confidence = EXCLUDED.confidence,
        source = EXCLUDED.source,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- Insert evidence document
CREATE OR REPLACE FUNCTION memory.insert_evidence_document(
    p_source            VARCHAR(50),
    p_document_type     VARCHAR(50),
    p_title             TEXT,
    p_language          VARCHAR(10),
    p_file_path         TEXT,
    p_file_hash         VARCHAR(64),
    p_file_size_bytes   INTEGER,
    p_url               TEXT,
    p_published_date    DATE,
    p_refresh_cycle     VARCHAR(20),
    p_metadata          JSONB
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO memory.evidence_document (
        source, document_type, title, language, file_path, file_hash,
        file_size_bytes, url, published_date, refresh_cycle, metadata
    ) VALUES (
        p_source, p_document_type, p_title, p_language, p_file_path, p_file_hash,
        p_file_size_bytes, p_url, p_published_date, p_refresh_cycle, p_metadata
    )
    ON CONFLICT (source, document_type, language, file_hash) DO UPDATE SET
        title = EXCLUDED.title,
        file_path = EXCLUDED.file_path,
        file_size_bytes = EXCLUDED.file_size_bytes,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;


-- Insert evidence chunk
CREATE OR REPLACE FUNCTION memory.insert_evidence_chunk(
    p_document_id       INTEGER,
    p_school_master_id  INTEGER,
    p_content           TEXT,
    p_language          VARCHAR(10),
    p_page_number       INTEGER,
    p_section           TEXT,
    p_chunk_index       INTEGER,
    p_token_count       INTEGER,
    p_embedding_id      UUID,
    p_embedding_model   VARCHAR(50),
    p_metadata          JSONB
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO memory.evidence_chunk (
        document_id, school_master_id, content, language,
        page_number, section, chunk_index, token_count,
        embedding_id, embedding_model, metadata
    ) VALUES (
        p_document_id, p_school_master_id, p_content, p_language,
        p_page_number, p_section, p_chunk_index, p_token_count,
        p_embedding_id, p_embedding_model, p_metadata
    )
    ON CONFLICT (document_id, chunk_index, language) DO UPDATE SET
        content = EXCLUDED.content,
        token_count = EXCLUDED.token_count,
        embedding_id = EXCLUDED.embedding_id,
        embedding_model = EXCLUDED.embedding_model,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;


-- Upsert school profile evidence (now with language)
CREATE OR REPLACE FUNCTION memory.upsert_profile_evidence(
    p_school_master_id  INTEGER,
    p_profile_type      VARCHAR(20),
    p_profile_key       VARCHAR(100),
    p_profile_value     TEXT,
    p_language          VARCHAR(10),
    p_source            VARCHAR(50),
    p_source_version    VARCHAR(50),
    p_confidence        REAL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO memory.school_profile_evidence (
        school_master_id, profile_type, profile_key, profile_value,
        language, source, source_version, confidence
    ) VALUES (
        p_school_master_id, p_profile_type, p_profile_key, p_profile_value,
        p_language, p_source, p_source_version, p_confidence
    )
    ON CONFLICT (school_master_id, profile_type, profile_key, source, language) DO UPDATE SET
        profile_value = EXCLUDED.profile_value,
        confidence = EXCLUDED.confidence,
        source_version = EXCLUDED.source_version,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- Upsert availability record (now with language)
CREATE OR REPLACE FUNCTION memory.upsert_availability(
    p_school_master_id  INTEGER,
    p_level             VARCHAR(10),
    p_vacancy_status    VARCHAR(10),
    p_vacancy_count     INTEGER,
    p_snapshot_date     DATE,
    p_language          VARCHAR(10),
    p_source            VARCHAR(50),
    p_source_version    VARCHAR(50)
) RETURNS VOID AS $$
BEGIN
    INSERT INTO memory.school_availability (
        school_master_id, level, vacancy_status, vacancy_count,
        snapshot_date, language, source, source_version
    ) VALUES (
        p_school_master_id, p_level, p_vacancy_status, p_vacancy_count,
        p_snapshot_date, p_language, p_source, p_source_version
    )
    ON CONFLICT (school_master_id, level, snapshot_date, language) DO UPDATE SET
        vacancy_status = EXCLUDED.vacancy_status,
        vacancy_count = EXCLUDED.vacancy_count,
        source_version = EXCLUDED.source_version,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- Upsert secondary network record
CREATE OR REPLACE FUNCTION memory.upsert_secondary_network(
    p_school_master_id  INTEGER,
    p_secondary_net     VARCHAR(10),
    p_primary_net       VARCHAR(10),
    p_is_serving        BOOLEAN,
    p_allocation_phase  VARCHAR(20),
    p_network_year      INTEGER,
    p_source            VARCHAR(50),
    p_source_version    VARCHAR(50)
) RETURNS VOID AS $$
BEGIN
    INSERT INTO memory.school_secondary_network (
        school_master_id, secondary_net, primary_net, is_serving,
        allocation_phase, network_year, source, source_version
    ) VALUES (
        p_school_master_id, p_secondary_net, p_primary_net, p_is_serving,
        p_allocation_phase, p_network_year, p_source, p_source_version
    )
    ON CONFLICT (school_master_id, secondary_net, primary_net, network_year) DO UPDATE SET
        is_serving = EXCLUDED.is_serving,
        allocation_phase = EXCLUDED.allocation_phase,
        source_version = EXCLUDED.source_version,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- Upsert school relationship (expanded)
CREATE OR REPLACE FUNCTION memory.upsert_school_relationship(
    p_source_school_id   INTEGER,
    p_target_school_id   INTEGER,
    p_relationship_type  VARCHAR(50),
    p_relationship_detail TEXT,
    p_group_id           VARCHAR(20),
    p_effective_year     INTEGER,
    p_expiry_year        INTEGER,
    p_confidence_score   REAL,
    p_remarks            TEXT,
    p_source             VARCHAR(50),
    p_source_version     VARCHAR(50)
) RETURNS VOID AS $$
BEGIN
    INSERT INTO memory.school_relationship (
        source_school_id, target_school_id, relationship_type,
        relationship_detail, group_id, effective_year, expiry_year,
        confidence_score, remarks, source, source_version
    ) VALUES (
        p_source_school_id, p_target_school_id, p_relationship_type,
        p_relationship_detail, p_group_id, p_effective_year, p_expiry_year,
        p_confidence_score, p_remarks, p_source, p_source_version
    )
    ON CONFLICT (source_school_id, target_school_id, relationship_type) DO UPDATE SET
        relationship_detail = EXCLUDED.relationship_detail,
        group_id = EXCLUDED.group_id,
        effective_year = EXCLUDED.effective_year,
        expiry_year = EXCLUDED.expiry_year,
        confidence_score = EXCLUDED.confidence_score,
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
    p_vacancy_count     INTEGER,
    p_snapshot_date     DATE,
    p_source            VARCHAR(50),
    p_source_version    VARCHAR(50)
) RETURNS VOID AS $$
BEGIN
    INSERT INTO memory.school_availability (
        school_master_id, level, vacancy_status, vacancy_count,
        snapshot_date, source, source_version
    ) VALUES (
        p_school_master_id, p_level, p_vacancy_status, p_vacancy_count,
        p_snapshot_date, p_source, p_source_version
    )
    ON CONFLICT (school_master_id, level, snapshot_date) DO UPDATE SET
        vacancy_status = EXCLUDED.vacancy_status,
        vacancy_count = EXCLUDED.vacancy_count,
        source_version = EXCLUDED.source_version,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- Upsert cost profile
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


-- Insert decision evidence
CREATE OR REPLACE FUNCTION memory.insert_decision_evidence(
    p_school_master_id      INTEGER,
    p_decision_id           UUID,
    p_evidence_type         VARCHAR(50),
    p_child_profile_summary JSONB,
    p_factor_type           VARCHAR(100),
    p_factor_value          TEXT,
    p_source                VARCHAR(50),
    p_weight                REAL,
    p_final_reason          TEXT,
    p_parent_id             VARCHAR(64),
    p_session_id            UUID,
    p_confidence            REAL
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO memory.decision_evidence (
        school_master_id, decision_id, evidence_type, child_profile_summary,
        factor_type, factor_value, source, weight, final_reason,
        parent_id, session_id, confidence
    ) VALUES (
        p_school_master_id, p_decision_id, p_evidence_type, p_child_profile_summary,
        p_factor_type, p_factor_value, p_source, p_weight, p_final_reason,
        p_parent_id, p_session_id, p_confidence
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;


-- =========================================================================
-- VERIFY: Show all Phase 10.2 tables and their row counts
-- =========================================================================
SELECT 'school_entity_master' AS table_name, COUNT(*) AS row_count FROM memory.school_entity_master
UNION ALL
SELECT 'school_entity_mapping', COUNT(*) FROM memory.school_entity_mapping
UNION ALL
SELECT 'school_alias', COUNT(*) FROM memory.school_alias
UNION ALL
SELECT 'school_secondary_network', COUNT(*) FROM memory.school_secondary_network
UNION ALL
SELECT 'school_primary_network', COUNT(*) FROM memory.school_primary_network
UNION ALL
SELECT 'school_relationship', COUNT(*) FROM memory.school_relationship
UNION ALL
SELECT 'school_profile_evidence', COUNT(*) FROM memory.school_profile_evidence
UNION ALL
SELECT 'school_availability', COUNT(*) FROM memory.school_availability
UNION ALL
SELECT 'school_cost_profile', COUNT(*) FROM memory.school_cost_profile
UNION ALL
SELECT 'decision_evidence', COUNT(*) FROM memory.decision_evidence
UNION ALL
SELECT 'evidence_document', COUNT(*) FROM memory.evidence_document
UNION ALL
SELECT 'evidence_chunk', COUNT(*) FROM memory.evidence_chunk;