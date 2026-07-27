# Hermes OS — Phase 10.1: Official School Data Ingestion Foundation

## Context Summary

Phase 9.2.2 (Decision Model with lifecycle state machine) is complete. Hermes Core now has:
- Three-tier memory (Profile → Event → Context Anchor)
- Education Decision Engine with status state machine (draft → active → evaluating → decided → archived)
- Decision entities and factors tracked per decision

The gap: **No structured school data.** The Education Engine currently operates on ad-hoc school info from LLM context. Phase 10.1 builds the data foundation so the engine can reference authoritative, versioned school data with provenance.

## Key Architectural Constraints

1. **Do NOT modify Core architecture.** No changes to `core/`, `phase9/`, or the Education Engine API.
2. **Do NOT modify existing services.** The knowledge service (`hermes-knowledge`) stays as-is — ingestion is a new standalone service.
3. **Docker containers cannot access the internet.** NAS host has connectivity; Docker containers do not. CSV download must happen on the NAS host, not inside a container.
4. **Evidence layer requires Fact + Source + Confidence.** Never fabricate data. If a field is NULL, it stays NULL. No inferred banding/ranking.

## Data Source

| Field | Value |
|-------|-------|
| Publisher | CHSC (Committee on Home-School Co-operation), via data.gov.hk |
| Dataset | `chsc-chsc-secondary-school-profiles` |
| CSV URL | `https://www.chsc.hk/datagovhk/ssp_2025_2026_en.csv` |
| Columns | 103 (see Appendix A) |
| Updates | Annual (school year cycle) |
| API Base | `https://data.gov.hk/en-data/api/3/action/` |

No EDB datasets exist on data.gov.hk. CHSC is the authoritative open-data source for HK schools.

---

## Phase 10.1-A: Raw Ingestion Service

### New Service: `education-ingestion`

Create a new Docker service `hermes-ingestion` alongside the existing stack. It is a standalone FastAPI service that owns the school data pipeline.

### Directory Structure

```
/volume3/hermes/source/ingestion/
├── Dockerfile
├── requirements.txt
├── main.py              # FastAPI entry point
├── config.py            # DB/Qdrant URLs from env
├── models.py            # Pydantic models
├── downloader.py        # CSV download + checksum
├── raw_store.py         # raw_school_source CRUD
├── normalizer.py        # field normalization
├── entity_resolver.py   # school identity resolution
├── pg_writer.py         # school_entity + school_attributes writer
├── qdrant_sync.py       # knowledge_education_v1 sync
└── tests/
    ├── test_downloader.py
    ├── test_normalizer.py
    ├── test_entity_resolver.py
    └── test_pipeline_e2e.py
```

### Database Schema (new tables in `memory` schema via PGStore)

```sql
-- Raw ingestion audit trail
CREATE TABLE IF NOT EXISTS memory.raw_school_source (
    id SERIAL PRIMARY KEY,
    source_name VARCHAR(128) NOT NULL,        -- 'chsc_secondary_csv'
    source_version VARCHAR(64) NOT NULL,       -- '2025_2026_en'
    source_url TEXT,                           -- CSV URL
    checksum VARCHAR(128),                     -- SHA256 of downloaded file
    raw_data JSONB NOT NULL,                   -- full row as JSON
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_raw_source ON memory.raw_school_source(source_name, source_version);

-- Canonical school entity
CREATE TABLE IF NOT EXISTS memory.school_entity (
    id SERIAL PRIMARY KEY,
    school_id VARCHAR(16) NOT NULL UNIQUE,     -- 'SCH-00001'
    canonical_name VARCHAR(256) NOT NULL,      -- normalized English name
    district VARCHAR(128),
    school_type VARCHAR(64),                   -- Aided / DSS / Government / Private
    student_gender VARCHAR(16),                -- Co-ed / Boys / Girls
    source_name VARCHAR(128) NOT NULL,         -- 'chsc_secondary_csv'
    source_version VARCHAR(64),                -- '2025_2026_en'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_school_entity_district ON memory.school_entity(district);
CREATE INDEX IF NOT EXISTS idx_school_entity_type ON memory.school_entity(school_type);

-- Key-value school attributes (extensible, no schema migration needed for new fields)
CREATE TABLE IF NOT EXISTS memory.school_attributes (
    id SERIAL PRIMARY KEY,
    school_id VARCHAR(16) NOT NULL REFERENCES memory.school_entity(school_id),
    attr_key VARCHAR(64) NOT NULL,             -- 'fees_s1', 'language_policy', 'facility_library', etc.
    attr_value TEXT NOT NULL,                  -- always stored as text; typed at read time
    attr_group VARCHAR(64),                    -- 'identity', 'academic', 'fees', 'facilities', 'policies'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, attr_key)
);
CREATE INDEX IF NOT EXISTS idx_school_attr_school ON memory.school_attributes(school_id);
CREATE INDEX IF NOT EXISTS idx_school_attr_key ON memory.school_attributes(attr_key);

-- Multilingual identity map (EN/TC/SC → canonical school_id)
CREATE TABLE IF NOT EXISTS memory.school_identity_map (
    id SERIAL PRIMARY KEY,
    school_id VARCHAR(16) NOT NULL REFERENCES memory.school_entity(school_id),
    language VARCHAR(8) NOT NULL,              -- 'en', 'zh-Hant', 'zh-Hans'
    name VARCHAR(256) NOT NULL,                -- name in this language
    normalized_name VARCHAR(256) NOT NULL,     -- lowercase, punctuation-stripped
    source VARCHAR(64),                        -- 'CHSC_CSV_EN', 'CHSC_CSV_TC', 'CHSC_CSV_SC'
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, language)
);
CREATE INDEX IF NOT EXISTS idx_identity_map_normalized ON memory.school_identity_map(normalized_name);
CREATE INDEX IF NOT EXISTS idx_identity_map_name ON memory.school_identity_map(name);
```

### downloader.py

```python
# Responsibilities:
# 1. Download CSV from CHSC URL to a temp path on NAS host
# 2. Compute SHA256 checksum
# 3. Parse CSV rows into list[dict]
# 4. Return parsed data + metadata

# IMPORTANT: Docker containers cannot reach the internet.
# The download step must be triggered from the NAS host, either:
#   - Via the ingestion API (container calls back to NAS-host download)
#   - Or: pre-download the CSV to a mounted volume, ingestion reads from disk
#
# RECOMMENDED APPROACH for deployment:
#   Mount /volume1/hermes-cold/documents/ingestion/ as a volume.
#   Pre-download CSV to that path from NAS host.
#   Ingestion service reads from the mounted path.
```

### main.py API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ingestion/run` | Trigger full pipeline: raw → normalize → entity → qdrant |
| POST | `/ingestion/raw` | Raw CSV ingestion only (store in raw_school_source) |
| POST | `/ingestion/normalize` | Normalize raw data → school_entity + school_attributes |
| POST | `/ingestion/resolve-entities` | Run entity resolution pass |
| POST | `/ingestion/sync-qdrant` | Sync school_entity to Qdrant knowledge_education_v1 |
| GET | `/ingestion/status` | Last run timestamps, row counts, errors |
| GET | `/health` | Health check |

### docker-compose addition

```yaml
hermes-ingestion:
  build:
    context: /volume3/hermes/source/ingestion
    dockerfile: Dockerfile
  image: hermes-ingestion:latest
  container_name: hermes-ingestion
  restart: unless-stopped
  volumes:
    - /volume3/hermes/source/ingestion:/app
    - /volume1/hermes-cold/documents/ingestion:/data/ingestion:ro  # read-only CSV mount
  environment:
    POSTGRES_HOST: hermes-postgres
    POSTGRES_PORT: "5432"
    POSTGRES_DB: hermes
    POSTGRES_USER: hermes
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    QDRANT_HOST: hermes-qdrant
    QDRANT_PORT: "6333"
  networks:
    - hermes-net
  depends_on:
    postgres:
      condition: service_healthy
    qdrant:
      condition: service_started
```

---

## Phase 10.1-B: Normalization

### school_normalizer.py

Field-by-field normalization rules from the 103-column CHSC CSV:

| CSV Column | Normalize Rule | Target Attr Key |
|------------|---------------|-----------------|
| district (col 0) | Title case, strip whitespace | `district` (→ school_entity) |
| school_name (col 1) | Title case, strip double spaces | `canonical_name` (→ school_entity) |
| school_address (col 2) | As-is, strip | `address` |
| school_tel (col 3) | Digits only, normalize format | `tel` |
| school_website (col 4) | Lowercase, ensure https:// prefix | `website` |
| school_email (col 5) | Lowercase, trim | `email` |
| school_type (col 13) | Map: DSS/Aided/Government/Private/Caput → canonical | `school_type` (→ school_entity) |
| student_gender (col 14) | Map: Co-ed/Boys/Girls → canonical | `student_gender` (→ school_entity) |
| sponsoring_body (col 18) | Title case, strip | `sponsoring_body` |
| religion (col 19) | Title case, map variants to canonical names | `religion` |
| language_policy (col 78) | Full text, preserve for embedding | `language_policy` |
| learning_and_teaching_strategies (col 79) | Full text | `learning_strategies` |
| Fees S1–S6 (col 53–58) | Parse integer, 0 if "N/A" or empty | `fees_s1` … `fees_s6` |
| Facilities (col 59–77) | Boolean: "Yes" → true, everything else → false | `facility_<name>` |
| Subjects S1–S6 (col 35–46) | Parse semicolon-separated lists → JSON arrays | `subjects_s1_chinese`, `subjects_s1_english`, etc. |
| Class counts (col 22–27) | Parse integer | `classes_s1` … `classes_s6` |
| Teacher count (col 28) | Parse integer | `teacher_count` |
| School mission (col 12) | Full text, preserve for embedding | `mission` |
| Student development fields (col 83–103) | Full text, preserve for embedding | `student_dev_4cs`, `student_dev_gifted`, etc. |

### Derived Academic Signals

From CHSC evidence, compute `academic_signal` attributes. These are NOT rankings — they are observable facts from the CSV.

```python
# Example academic_signal derivation (NOT banding):
# 
# "language_strength": "high" when:
#   - school_type == "DSS" OR
#   - S4-S6 English-taught subject count >= 5
#
# "science_subject_availability": "high" when:
#   - S4-S6 subjects include Biology + Chemistry + Physics in English
#
# "subject_breadth": count of distinct subjects offered across S4-S6
#
# Each signal stored as:
#   school_attributes(school_id, 'academic_signal_language_strength', 'high')
#   school_attributes(school_id, 'academic_signal_science_availability', 'high')
```

Source for every signal: CHSC CSV, column range 35–46 (subject offerings by language).

---

## Phase 10.1-C: Entity Resolution

### The Problem

Hong Kong schools appear in multiple languages:
- English CSV: `King's College`
- Traditional Chinese CSV: `英皇書院`
- Simplified Chinese CSV: `英皇书院`

All three refer to the same physical school. For the Decision Engine to work, all three must resolve to `SCH-00042`.

### Resolution Pipeline

```
raw_name (any language)
    │
    ▼
┌─────────────────────────┐
│ 1. Unicode normalize    │  NFC normalization
│ 2. Strip punctuation    │  ' " , . ( ) - —
│ 3. Strip whitespace     │  collapse multiple spaces
│ 4. Lowercase            │  case-insensitive match
│ 5. Script detect        │  is it Latin, Hant, or Hans?
│ 6. Convert to Hant      │  Hans → Hant via OpenCC (or character mapping table)
│ 7. Lookup identity_map  │  SELECT school_id FROM school_identity_map
│    └─ Match? → RETURN    │      WHERE normalized_name = $1
│ 8. Alias lookup          │  Check known abbreviations/aliases
│    └─ Match? → RETURN    │
│ 9. INSERT new entity     │  New school_id = 'SCH-{seq:05d}'
└─────────────────────────┘
```

### Alias Table

```sql
CREATE TABLE IF NOT EXISTS memory.school_alias (
    id SERIAL PRIMARY KEY,
    school_id VARCHAR(16) NOT NULL REFERENCES memory.school_entity(school_id),
    alias VARCHAR(256) NOT NULL,
    alias_normalized VARCHAR(256) NOT NULL,
    source VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alias_normalized ON memory.school_alias(alias_normalized);
```

### Multilingual CSV Strategy

The CHSC dataset publishes 3 language variants. Ingestion order matters:

1. **Ingest English CSV first** — creates canonical `school_entity` rows, populates `school_identity_map` with `language='en'`
2. **Ingest TC CSV** — for each row, resolve against existing `school_identity_map`; if match found, add TC name entry; if no match, create new entity
3. **Ingest SC CSV** — same as TC; resolve first, create only if unmatched

Resolution key: schools in all 3 CSVs share the same `SCHOOL_NO` (column in CHSC data). If CHSC provides a school number, use it as the primary cross-language key. Otherwise fall back to the normalized-name resolution pipeline.

---

## Phase 10.1-D: Knowledge Sync

### PostgreSQL → Qdrant

After normalization, sync each school to `knowledge_education_v1`:

```python
# For each school_entity row:
point_id = school_id  # "SCH-00042"
vector = embed(school_text_blob)  # when embedding model is wired; for now use zero vector
payload = {
    "school_id": school_id,
    "name": canonical_name,
    "district": district,
    "school_type": school_type,
    "student_gender": student_gender,
    "source": "CHSC",
    "source_version": "2025_2026_en",
    "confidence": 1.0,
    "content": formatted_school_blob,  # human-readable summary for LLM context
    # Include all attributes for filtering
    "fees_s1": fees_s1,
    "religion": religion,
    # ...
}
```

The `content` field should be a structured text blob:

```
Name: King's College
District: Central & Western
Type: Government
Gender: Boys
Religion: Christian
Fees S1: 0 (free)
Language Policy: English as medium of instruction
Subjects (S4-S6 English): Biology, Chemistry, Physics, Economics, ...
Facilities: Library, Swimming Pool, ...
```

This blob is what the LLM reads when the knowledge service returns this school as a search result.

### Filter Support

Enable the Education Engine to filter schools by constraints BEFORE ranking:
- `district` = "Kowloon City"
- `school_type` = "DSS"
- `student_gender` = "Co-ed"
- `fees_s1` <= 80000

These filters are metadata-level in Qdrant (already supported by the knowledge service's `filters` parameter).

---

## Phase 10.2: Recommendation History (Parallel)

While Phase 10.1 builds the data foundation, Phase 10.2 builds the output-side feedback loop.

### Schema

```sql
-- Each time the Education Engine generates a recommendation
CREATE TABLE IF NOT EXISTS memory.recommendation_session (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'default',
    decision_id INTEGER REFERENCES memory.decision_context(id),
    child_profile JSONB,              -- snapshot of child_age, interests, preferences
    family_constraints JSONB,         -- snapshot of district, budget, gender, religion
    total_schools_considered INTEGER, -- how many schools passed constraint filter
    total_ranked INTEGER,             -- how many were ranked by fit
    engine_version VARCHAR(32),       -- '1.0.0'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual school recommendation within a session
CREATE TABLE IF NOT EXISTS memory.recommendation_result (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES memory.recommendation_session(id),
    school_id VARCHAR(16) NOT NULL REFERENCES memory.school_entity(school_id),
    rank INTEGER NOT NULL,             -- 1-based rank
    constraint_score REAL,             -- 0.0–1.0 how well constraints are met
    fit_score REAL,                    -- 0.0–1.0 how well child profile matches
    overall_score REAL,                -- weighted composite
    match_reasons JSONB,               -- [{"factor": "district_match", "weight": 0.3}, ...]
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, school_id)
);

-- Explicit user feedback on a recommendation
CREATE TABLE IF NOT EXISTS memory.recommendation_feedback (
    id SERIAL PRIMARY KEY,
    result_id INTEGER NOT NULL REFERENCES memory.recommendation_result(id),
    user_id VARCHAR(64) NOT NULL DEFAULT 'default',
    action VARCHAR(16) NOT NULL,       -- 'saved', 'dismissed', 'visited', 'applied'
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),  -- optional explicit rating
    note TEXT,                         -- free-text user note
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Integration Points

These tables are **write-only** from the perspective of the Education Engine. The engine creates a `recommendation_session` when it generates school rankings, and writes `recommendation_result` rows for each ranked school.

The feedback loop is closed later when users interact with the recommendations — the frontend calls back to record `recommendation_feedback`.

The PGStore functions for these tables live in the existing `phase9/pg_store.py` alongside the decision tables, since they share the `memory` schema.

---

## Tests

### test_downloader.py
- Mock HTTP response with a 5-row CSV fixture
- Verify checksum computation
- Verify all 103 columns parsed
- Verify empty CSV → empty list, no crash
- Verify malformed CSV (wrong column count) → error logged, row skipped

### test_normalizer.py
- District: "kowloon city" → "Kowloon City"
- Fees: "25,000" → 25000, "" → None, "N/A" → None
- Facility: "Yes" → True, "No" → False, "" → False
- Subjects: "Biology; Chemistry; Physics" → ["Biology", "Chemistry", "Physics"]
- School type: "DSS" → "DSS", "AIDED" → "Aided"
- Gender: "Co-Ed" → "Co-ed", "BOYS" → "Boys"

### test_entity_resolver.py
- "King's College" → resolves to same school_id as "英皇書院"
- "Diocesan Boys' School" → resolves to same school_id as "拔萃男書院"
- Stripping punctuation: "St. Paul's" matches "St Pauls"
- New school → generates new school_id
- Same name, different district → DIFFERENT school_id (different entity)

### test_pipeline_e2e.py
- Load 5-row CSV fixture → run full pipeline
- Verify 5 rows in raw_school_source
- Verify 5 rows in school_entity
- Verify attributes populated for each school
- Verify identity_map populated
- Verify no duplicate entities on re-run (idempotent)

---

## Appendix A: CHSC CSV Column Map (Key Columns)

| Col | Field | Example |
|-----|-------|---------|
| 0 | district | Kowloon City |
| 1 | school_name | Diocesan Boys' School |
| 2 | school_address | 131 Argyle Street |
| 3 | school_tel | 27115191 |
| 4 | school_website | https://www.dbs.edu.hk |
| 12 | school_mission_and_character | (long text) |
| 13 | school_type | DSS |
| 14 | student_gender | Boys |
| 18 | sponsoring_body | Sheng Kung Hui |
| 19 | religion | Christian |
| 22–27 | S1–S6 class counts | 5, 5, 5, 5, 5, 5 |
| 28 | teacher_count | 95 |
| 35–40 | S1-S3 subjects (CHI/ENG/OTH) | Chinese; English; French |
| 41–46 | S4-S6 subjects (CHI/ENG/OTH) | Biology; Chemistry; Physics |
| 53–58 | S1–S6 fees | 52500, 52500, 52500, 52500, 52500, 52500 |
| 59–77 | Facilities (19 boolean fields) | Yes/No |
| 78 | language_policy | (long text) |
| 79 | learning_and_teaching_strategies | (long text) |
| 83–103 | Student development (20+ fields) | (long text) |

Full 103-column schema available at: `https://www.chsc.hk/datagovhk/ssp_2025_2026_en.csv` (row 1 = header)

## Appendix B: Deployment Checklist

1. [ ] Create `/volume3/hermes/source/ingestion/` directory
2. [ ] Write all source files
3. [ ] Create Dockerfile for ingestion service
4. [ ] Add `hermes-ingestion` to `docker-compose.yml`
5. [ ] Download CSV to NAS host: `curl -o /volume1/hermes-cold/documents/ingestion/ssp_2025_2026_en.csv "https://www.chsc.hk/datagovhk/ssp_2025_2026_en.csv"`
6. [ ] Run schema migration (4 new tables + recommendation_history tables)
7. [ ] Build: `docker compose build --no-cache hermes-ingestion`
8. [ ] Deploy: `docker compose up -d hermes-ingestion`
9. [ ] Trigger ingestion: `curl -X POST http://192.168.9.2:8011/ingestion/run`
10. [ ] Verify: `curl http://192.168.9.2:8011/ingestion/status`
11. [ ] Run regression tests
12. [ ] Verify Qdrant: check `knowledge_education_v1` collection has points
