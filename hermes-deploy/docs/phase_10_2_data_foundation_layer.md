# Phase 10.2 — Education Data Foundation Layer
# data.gov.hk 9 Datasets → 6-Layer Classification

## Overview

The 9 datasets from data.gov.hk are not a single "EDB dataset" — they form an **Education Data Lake** that maps to 6 distinct architectural layers.

---

## Dataset Inventory

| # | Dataset | Format | Size | Update Frequency |
|---|---------|--------|------|------------------|
| 1 | 學校位置及資料 (School Location and Information) | JSON | ~600+ schools | Monthly |
| 2 | 中學學位分配辦法學校網資料 (SSPA School Serving Net) | CSV | ~441 schools | Annual |
| 3 | 「一條龍」學校名單 (Through-train Schools) | CSV | ~60 groups | Annual |
| 4 | 學校註冊資料 (School Registration) | XML | ~1000+ schools | Annual |
| 5 | 小一入學統籌辦法學校網範圍 (POA School Net) | CSV | ~50 nets | Annual |
| 6 | 中學概覽 (Secondary School Profiles) | CSV | ~441 schools | Annual |
| 7 | 小學概覽 (Primary School Profiles) | CSV | ~500+ schools | Annual |
| 8 | 幼稚園及幼稚園暨幼兒中心概覽 (KG Profiles) | CSV | ~1000+ schools | Annual |
| 9 | 幼稚園幼兒班至高班（K1-K3）學位空缺資料 | CSV | ~1000+ schools | Monthly |

---

## 6-Layer Classification

### Layer 1 — School Entity Master (身份層)

**Purpose**: Canonical school identity — the anchor for all cross-source resolution.

**Source Datasets**:
| Dataset | Role |
|---------|------|
| ✅ 學校位置及資料 (SCH_LOC_EDB) | Primary source — official identity, geo, website |
| ✅ 學校註冊資料 (SchoolBasicInfo.xml) | Cross-validation — registration status, official school number |

**Fields**:
| Field | Source | DB Column |
|-------|--------|-----------|
| School No. | EDB JSON / XML | `edb_school_no` |
| School Name (EN/ZH) | EDB JSON / XML | `school_name_en`, `school_name_zh` |
| Address (EN/ZH) | EDB JSON | `address_en`, `address_zh` |
| Latitude / Longitude | EDB JSON | `latitude`, `longitude` |
| District | EDB JSON / XML | `district` |
| School Level | EDB JSON / XML | `school_level` |
| Finance Type | EDB JSON / XML | `finance_type` |
| Religion | EDB JSON | `religion` |
| Website | EDB JSON | `website` |
| Phone / Fax / Email | EDB JSON | `phone`, `fax`, `email` |
| Student Gender | EDB JSON / XML | `student_gender` |
| Session Type | EDB JSON | `session_type` |

**Table**: `memory.school_entity_master` (already created in Phase 10.2.1)

**Note**: `school_cost_profile` was originally in Layer 1 but moved to **Layer 6** (Cost Intelligence) — fees are NOT identity, they are time-sensitive financial data.

---

### Layer 2 — Admission Structure (升學制度層)

**Purpose**: Hong Kong school admission is NOT distance-based. It's a **net-based system**:
```
Home Address → Primary School Net → Secondary School Net → Applicable Schools
```

This layer is **critical** for answering: "九龍城區 Band 1 女仔有什麼選擇？"

**Source Datasets**:
| Dataset | Role |
|---------|------|
| ✅ 中學學位分配辦法學校網資料 (SSPA) | Secondary school networks — which schools serve which nets |
| ✅ 小一入學統籌辦法學校網範圍 (POA) | Primary school nets — geographic areas → school nets |

**SSPA CSV Structure**:
```
Net, DIST, Sch Code, SCH_NAME, HK1, HK2, HK3, HK4, KL1, KL2, ..., NT9
HK1, CW, 510408, KING'S COLLEGE, Y, Y, Y, Y, ..., Y
```
- `Net`: Secondary school net (e.g., HK1 = Hong Kong 1)
- `DIST`: District code
- `Sch Code`: School code (links to EDB school_no)
- `HK1-NT9`: Boolean flags — which primary nets feed into this secondary school

**POA CSV Structure**:
```
SCHOOLNET, AREA, WEBPAGE
95, "SAI KUNG, LEUNG SHUEN WAN, ...", http://...
```
- `SCHOOLNET`: Primary school net number
- `AREA`: Geographic areas covered

**New Tables**:
```sql
-- Secondary school network (renamed from school_sspa_serving)
-- Rationale: "serving" is too narrow. This table models the entire
--            secondary school net structure, not just serving relationships.
-- Future: 自行分配學位, 統一派位, Band allocation, Choice priority
CREATE TABLE memory.school_secondary_network (
    id              SERIAL PRIMARY KEY,
    school_master_id INTEGER REFERENCES memory.school_entity_master(id),
    secondary_net   VARCHAR(10),        -- e.g., "HK1", "KL2"
    primary_net     VARCHAR(10),        -- e.g., "HK1", "HK2", "NT5"
    is_serving      BOOLEAN DEFAULT TRUE,
    allocation_phase VARCHAR(20),       -- discretionary / central / future
    source          VARCHAR(50) DEFAULT 'EDB_SSPA',
    source_version  VARCHAR(50),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, secondary_net, primary_net)
);

-- Primary school net geographic areas
CREATE TABLE memory.school_primary_network (
    id              SERIAL PRIMARY KEY,
    net_number      VARCHAR(10) UNIQUE,  -- e.g., "11", "95"
    areas           TEXT,                -- Comma-separated areas
    district        VARCHAR(100),        -- Derived district
    webpage         TEXT,
    source          VARCHAR(50) DEFAULT 'EDB_POA',
    source_version  VARCHAR(50),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Layer 3 — School Relationship Graph (關係層)

**Purpose**: Model school relationships for Graph RAG — especially "through-train" (一條龍) schools.

**Source Datasets**:
| Dataset | Role |
|---------|------|
| ✅ 「一條龍」學校名單 | Through-train relationships — primary → secondary direct linkage |

**Through-train CSV Structure**:
```
GroupID, SchoolName, District, Remarks
1, Tin Shui Wai Methodist Primary School, Yuen Long,
1, Tin Shui Wai Methodist College, Yuen Long,
```
- `GroupID`: Links schools in the same through-train group
- A group typically has 1 primary + 1 secondary school

**Relationship Types** (expanded):
| Type | Description |
|------|-------------|
| `through_train` | 一條龍 — primary feeds directly to secondary |
| `feeder` | 直屬 — feeder school relationship |
| `nominated` | 聯繫 — nominated school relationship |
| `affiliated` | 同一辦學團體 — same sponsoring organization |
| `same_organization` | 同一機構 — same organization group |
| `sister_school` | 姊妹學校 — sister school relationship |

**New Table**:
```sql
CREATE TABLE memory.school_relationship (
    id                  SERIAL PRIMARY KEY,
    source_school_id    INTEGER REFERENCES memory.school_entity_master(id),
    target_school_id    INTEGER REFERENCES memory.school_entity_master(id),
    relationship_type   VARCHAR(50),        -- through_train / feeder / nominated / affiliated / same_organization / sister_school
    relationship_detail TEXT,               -- Additional details
    group_id            VARCHAR(20),        -- EDB group identifier
    effective_year      INTEGER,            -- Year relationship became effective
    expiry_year         INTEGER,            -- Year relationship expired (if applicable)
    remarks             TEXT,
    source              VARCHAR(50) DEFAULT 'EDB_THROUGH_TRAIN',
    source_version      VARCHAR(50),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_school_id, target_school_id, relationship_type)
);
```

**Graph Visualization**:
```
Primary School ──through_train──→ Secondary School
      │
      ├──feeder──→ Secondary School (直屬)
      │
      ├──nominated──→ Secondary School (聯繫)
      │
      ├──affiliated──→ Same Sponsoring Body
      │
      └──sister_school──→ Sister School (姊妹學校)
```

---

### Layer 4 — School Intelligence Profile (學校情報層)

**Purpose**: Rich school profiles for recommendation reasoning — mission, curriculum, facilities, language policy.

**Source Datasets**:
| Dataset | Role |
|---------|------|
| ✅ 中學概覽 (SSP) | Secondary school profiles — mission, curriculum, activities |
| ✅ 小學概覽 (PSP) | Primary school profiles — mission, curriculum, activities |
| ✅ 幼稚園及幼稚園暨幼兒中心概覽 (KGP) | Kindergarten profiles |

**Note**: CHSC already provides secondary school profiles (441 schools). The EDB 中學概覽 is the **official** version — should be cross-referenced.

**Key Fields** (from SSP/PSP/KGP):
- `school_mission` — School mission statement
- `school_motto` — School motto
- `medium_of_instruction` — Language policy
- `sponsoring_body` — Sponsoring organization
- `commencement_of_operation_year` — Founded year
- `school_size` — School size
- `parent_teacher_association` — PTA exists
- `student_union_association` — Student union exists
- `through_train_sec_school` — Linked secondary (for primary schools)
- `feeder_sec_school` — Feeder secondary
- `nominated_sec_school` — Nominated secondary

**New Table**:
```sql
CREATE TABLE memory.school_profile_evidence (
    id                      SERIAL PRIMARY KEY,
    school_master_id        INTEGER REFERENCES memory.school_entity_master(id),
    profile_type            VARCHAR(20),        -- mission / curriculum / facility / language / activity / history / organization
    profile_key             VARCHAR(100),       -- e.g., "school_mission", "medium_of_instruction"
    profile_value           TEXT,
    source                  VARCHAR(50),        -- EDB_SSP / EDB_PSP / EDB_KGP / CHSC
    source_version          VARCHAR(50),
    confidence              REAL DEFAULT 0.9,
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, profile_type, profile_key, source)
);
```

---

### Layer 5 — Availability / Market Signal (供應信號)

**Purpose**: Time-sensitive vacancy data — market signal for kindergarten admission.

**Source Datasets**:
| Dataset | Role |
|---------|------|
| ✅ 幼稚園 K1-K3 學位空缺 | Kindergarten vacancy status — real-time availability |

**Vacancy CSV Structure**:
```
District, SCRN, School English Name, School Chinese Name,
K1 Vacancy Status, K2 Vacancy Status, K3 Vacancy Status, As At Date
```
- `SCRN`: School code (links to EDB school_no)
- `K1/K2/K3 Vacancy Status`: Y (vacancy) / N (no vacancy)
- `As At Date`: Snapshot date

**New Table**:
```sql
CREATE TABLE memory.school_availability (
    id                      SERIAL PRIMARY KEY,
    school_master_id        INTEGER REFERENCES memory.school_entity_master(id),
    level                   VARCHAR(10),        -- K1 / K2 / K3
    vacancy_status          VARCHAR(10),        -- Y / N / L (limited)
    vacancy_count           INTEGER,            -- Optional: actual number of vacancies
    snapshot_date           DATE NOT NULL,
    source                  VARCHAR(50) DEFAULT 'EDB_KG_VACANCY',
    source_version          VARCHAR(50),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, level, snapshot_date)
);
```

**Important**: This is **time-sensitive** data. Never merge into `school_entity_master`. Always query with `snapshot_date`.

---

### Layer 6 — Cost Intelligence + Decision Evidence (成本情報 + 決策證據)

**Purpose**: Time-sensitive fee data AND parent decision cases for recommendation reasoning.

**Rationale for separate layer**:
- Master identity changes rarely (yearly)
- Fees change yearly or more frequently
- Mixing them causes staleness pollution
- Decision evidence is a different data type (cases, reasoning traces)

**Source Datasets**:
| Dataset | Role |
|---------|------|
| ✅ 中學概覽 (SSP) | Secondary school fees (from official profiles) |
| ✅ 小學概覽 (PSP) | Primary school fees |
| ✅ 幼稚園概覽 (KGP) | Kindergarten fees |
| ✅ CHSC | Cross-reference fee data |
| ✅ Parent Reports | Anonymized parent cost reports |

**Cost Types**: tuition / lunch / activity / uniform / bus / other

**New Tables**:
```sql
-- Cost Intelligence (moved from Layer 1)
CREATE TABLE memory.school_cost_profile (
    id                  SERIAL PRIMARY KEY,
    school_master_id    INTEGER REFERENCES memory.school_entity_master(id),
    cost_type           VARCHAR(50) NOT NULL,          -- tuition / lunch / activity / uniform / bus / other
    amount              NUMERIC(12,2),
    currency            VARCHAR(3) DEFAULT 'HKD',
    year                INTEGER NOT NULL,              -- Academic year start (e.g., 2025 for 2025-2026)
    source              VARCHAR(50),                   -- school_website / chsc / parent_report / manual
    confidence          REAL DEFAULT 0.5,
    evidence_url        TEXT,
    notes               TEXT,
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_master_id, cost_type, year, source)
);

-- Decision Evidence (new — for parent cases, recommendation reasoning)
CREATE TABLE memory.decision_evidence (
    id                      SERIAL PRIMARY KEY,
    school_master_id        INTEGER REFERENCES memory.school_entity_master(id),
    evidence_type           VARCHAR(50) NOT NULL,
        -- parent_case / recommendation_reason / agent_reasoning / parent_feedback
    child_profile_summary   JSONB,                      -- Anonymized child profile snapshot
    factor                  VARCHAR(100),               -- e.g., "academic_fit", "distance", "language"
    factor_value            TEXT,                       -- e.g., "Band 1", "within 2km", "EMI"
    weight                  REAL,                       -- Factor weight in decision
    final_reason            TEXT,                       -- Human-readable reasoning
    parent_id               VARCHAR(64),                -- Anonymized parent identifier
    session_id              UUID,                       -- Links to recommendation_session
    source                  VARCHAR(50) DEFAULT 'AGENT',
    confidence              REAL DEFAULT 0.5,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

**Use Cases for Decision Evidence**:
- "上次推薦咗咩學校比類似背景的家庭？"
- "呢間學校推薦理由係咩？"
- "其他家長點睇呢間學校？"

---

## Final Schema Architecture

```
                        data.gov.hk (9 datasets)
                                |
        -------------------------------------------------------
        |           |           |           |           |
   Layer 1     Layer 2     Layer 3     Layer 4     Layer 5
   Master      Admission   Relation    Profile     Availability
   Identity    Structure   Graph       Evidence    Signal
        |           |           |           |           |
        -------------------------------------------------------
                                |
                    Education Knowledge Graph
                                |
        -------------------------------------------------------
        |           |           |           |
     Ranking     RAG Evidence   Decision    Recommendation
     Engine      (reasoning)    Engine      Reasoning

        -------------------------------------------------------
                        Layer 6
                Cost Intelligence + Decision Evidence
```

---

## Priority & Implementation Order

### Batch 0 — Entity Resolution Validation (NEW — must run FIRST)
| Priority | Layer | Task | Impact |
|----------|-------|------|--------|
| 0 | Pre | Entity Resolution Validation | Validate EDB ↔ CHSC mapping before ingesting profiles |

**Rationale**: Without validated entity mapping, profile data from different sources cannot be correctly linked to the same school. This prevents garbage-in-gbage-out.

**Script**: `ingestion/entity_resolution_validator.py`

### Batch 1 — Identity + Knowledge (直接提升回答品質)
| Priority | Layer | Dataset | Impact |
|----------|-------|---------|--------|
| 1 | Layer 1 | 學校位置及資料 | ✅ Already done (Phase 10.2.1) |
| 2 | Layer 1 | 學校註冊資料 | Cross-validation for entity master |
| 3 | Layer 4 | 中學概覽 | Rich profiles for secondary recommendations |
| 4 | Layer 4 | 小學概覽 | Rich profiles for primary recommendations |
| 5 | Layer 4 | 幼稚園概覽 | Rich profiles for KG recommendations |

### Batch 2 — Graph Intelligence (建立 Graph RAG)
| Priority | Layer | Dataset | Impact |
|----------|-------|---------|--------|
| 6 | Layer 3 | 一條龍學校名單 | Through-train relationships |
| 7 | Layer 2 | 中學學位分配學校網 | Secondary admission logic |
| 8 | Layer 2 | 小一入學學校網 | Primary admission logic |

### Batch 3 — Real-time Service (即時服務)
| Priority | Layer | Dataset | Impact |
|----------|-------|---------|--------|
| 9 | Layer 5 | K1-K3 空缺 | Kindergarten vacancy status |

### Batch 4 — Cost Intelligence + Decision Evidence
| Priority | Layer | Dataset | Impact |
|----------|-------|---------|--------|
| 10 | Layer 6 | SSP/PSP/KGP fee data | Cost profiles for budget-conscious parents |
| 11 | Layer 6 | Agent-generated | Decision evidence from recommendation sessions |

---

## Evidence Provenance with field_sources

The `field_sources` design in `evidence_tracer.py` is perfect for this multi-source data:

```python
# Example field_sources mapping for a school
field_sources = {
    # Layer 1 — Master Identity (EDB)
    "district": "EDB_SCH_LOC",
    "latitude": "EDB_SCH_LOC",
    "longitude": "EDB_SCH_LOC",
    "website": "EDB_SCH_LOC",
    "finance_type": "EDB_SCH_LOC",

    # Layer 2 — Admission Structure (EDB)
    "secondary_net": "EDB_SSPA",
    "primary_net": "EDB_POA",

    # Layer 3 — Relationship Graph (EDB)
    "through_train": "EDB_THROUGH_TRAIN",
    "feeder_school": "EDB_THROUGH_TRAIN",
    "affiliated": "EDB_AFFILIATED",

    # Layer 4 — Profile Evidence (EDB + CHSC)
    "school_mission": "EDB_SSP",
    "medium_of_instruction": "EDB_SSP",
    "academic_signal_stem": "CHSC",  # From CHSC, not EDB
    "band": "CHSC",

    # Layer 5 — Availability (EDB)
    "k1_vacancy": "EDB_KG_VACANCY",

    # Layer 6 — Cost Intelligence (EDB + CHSC + parent_report)
    "tuition": "SCHOOL_WEBSITE",
    "lunch_fee": "CHSC",
}
```

---

## Source Registry Updates

Add to `ingestion/config.py`:

```python
# Layer 2 — Admission Structure
EDB_SSPA_SERVING_NET = {
    "name": "edb_sspa_serving_net",
    "publisher": "EDB",
    "dataset": "sspa_school_serving_net",
    "source_type": "admission_structure",
    "version": "2026",
    "url": "https://www.edb.gov.hk/en/edu-system/primary-secondary/spa-systems/secondary-spa/general-info/sspa-school-serving-net.html",
    "local_path": os.path.join(CSV_MOUNT_PATH, "edb", "sspa", "SSPA_SchServingNet_en.csv"),
}

EDB_POA_SCHOOL_NET = {
    "name": "edb_poa_school_net",
    "publisher": "EDB",
    "dataset": "poa_school_net",
    "source_type": "admission_structure",
    "version": "2026",
    "url": "https://www.edb.gov.hk/en/edu-system/primary-secondary/spa-systems/primary-school-aa/general-info/poa-school-net.html",
    "local_path": os.path.join(CSV_MOUNT_PATH, "edb", "poa", "POA_SchoolNet_EN.csv"),
}

# Layer 3 — Relationship Graph
EDB_THROUGH_TRAIN = {
    "name": "edb_through_train_schools",
    "publisher": "EDB",
    "dataset": "through_train_schools",
    "source_type": "school_relationship",
    "version": "2026",
    "url": "https://www.edb.gov.hk/en/edu-system/primary-secondary/applicable-to-primary-secondary/through-train-schools.html",
    "local_path": os.path.join(CSV_MOUNT_PATH, "edb", "through_train", "Through-train-schools-en.csv"),
}

# Layer 4 — Profile Evidence
EDB_SSP_PROFILES = {
    "name": "edb_secondary_school_profiles",
    "publisher": "EDB",
    "dataset": "secondary_school_profiles",
    "source_type": "school_profile",
    "version": "2025_2026",
    "url": "https://www.edb.gov.hk/en/student-parents/sch-info/sch-search/sch_profiles_info/secondary-sch-profiles.html",
    "local_path": os.path.join(CSV_MOUNT_PATH, "edb", "ssp", "ssp_2025_2026_en.csv"),
}

# Layer 5 — Availability
EDB_KG_VACANCY = {
    "name": "edb_kg_vacancy",
    "publisher": "EDB",
    "dataset": "kg_vacancy_information",
    "source_type": "availability_signal",
    "version": "202627",
    "url": "https://www.edb.gov.hk/en/student-parents/sch-info/sch-search/sch_profiles_info/kg-vacancy-information.html",
    "local_path": os.path.join(CSV_MOUNT_PATH, "edb", "kg_vacancy", "K1-K3_vacancy_information_en_202627.csv"),
}
```

---

## Summary

| Layer | DB Table | Source Count | Status |
|-------|----------|--------------|--------|
| 1. Master Identity | `school_entity_master` | 2 datasets | ✅ Done |
| 2. Admission Structure | `school_secondary_network`, `school_primary_network` | 2 datasets | ⏳ Batch 2 |
| 3. Relationship Graph | `school_relationship` | 1 dataset | ⏳ Batch 2 |
| 4. Profile Evidence | `school_profile_evidence` | 3 datasets | ⏳ Batch 1 |
| 5. Availability Signal | `school_availability` | 1 dataset | ⏳ Batch 3 |
| 6. Cost Intelligence | `school_cost_profile` | 3+ datasets | ⏳ Batch 4 |
| 6. Decision Evidence | `decision_evidence` | Agent-generated | ⏳ Batch 4 |

**Total**: 9 datasets → 6 layers → 8 new tables (1 already created)
