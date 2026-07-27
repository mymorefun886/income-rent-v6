# Hermes Ingestion — Configuration
# Reads DB and Qdrant connection info from environment.

import os

POSTGRES_HOST = os.getenv("POSTGRES_HOST", "hermes-postgres")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.getenv("POSTGRES_DB", "hermes")
POSTGRES_USER = os.getenv("POSTGRES_USER", "hermes")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")

QDRANT_HOST = os.getenv("QDRANT_HOST", "hermes-qdrant")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))

CSV_MOUNT_PATH = os.getenv("CSV_MOUNT_PATH", "/data/ingestion")

# CHSC data sources
CHSC_SECONDARY_EN = {
    "name": "chsc_secondary_csv",  # internal lookup key
    "publisher": "CHSC",
    "dataset": "secondary_school_profiles",
    "source_type": "school_profile",
    "version": "2025_2026_en",
    "url": "https://www.chsc.hk/datagovhk/ssp_2025_2026_en.csv",
    "local_path": os.path.join(CSV_MOUNT_PATH, "chsc", "secondary", "ssp_2025_2026_en.csv"),
}

CHSC_SECONDARY_TC = {
    "name": "chsc_secondary_csv",
    "publisher": "CHSC",
    "dataset": "secondary_school_profiles",
    "source_type": "school_profile",
    "version": "2025_2026_tc",
    "url": "https://www.chsc.hk/datagovhk/ssp_2025_2026_tc.csv",
    "local_path": os.path.join(CSV_MOUNT_PATH, "chsc", "secondary", "ssp_2025_2026_tc.csv"),
}

CHSC_SECONDARY_SC = {
    "name": "chsc_secondary_csv",
    "publisher": "CHSC",
    "dataset": "secondary_school_profiles",
    "source_type": "school_profile",
    "version": "2025_2026_sc",
    "url": "https://www.chsc.hk/datagovhk/ssp_2025_2026_sc.csv",
    "local_path": os.path.join(CSV_MOUNT_PATH, "chsc", "secondary", "ssp_2025_2026_sc.csv"),
}

CHSC_SOURCES = [CHSC_SECONDARY_EN, CHSC_SECONDARY_TC, CHSC_SECONDARY_SC]

# EDB (Education Bureau) — School Master Registry
# Source: data.gov.hk JSON API (updated annually)
# Role: Official school identity, address, coordinates, website
# Note: EDB does NOT contain fee/tuition data
EDB_MASTER_REGISTRY = {
    "name": "edb_school_master_json",
    "publisher": "EDB",
    "dataset": "school_location_and_data",
    "source_type": "master_registry",
    "version": "2026-07-01",
    "url": "https://www.edb.gov.hk/en/student-parents/sch-info/sch-search/schlocation.html",
    "api_url": "https://www.edb.gov.hk/tc/student-parents/sch-info/sch-search/schlocation.html",
    "local_path": os.path.join(CSV_MOUNT_PATH, "edb", "SCH_LOC_EDB.json"),
    "format": "json",
    "refresh_cycle": "monthly",
    "credibility": 9.0,
    "fields_count": 39,
    "coverage": "all_levels",
    "has_fee_data": False,
    "has_academic_data": False,
    "has_coordinates": True,
    "has_website": True,
}

# ── Layer 2 — Admission Structure (升學制度層) ─────────────────────────
# SSPA: Secondary School Serving Net (中學學位分配辦法學校網資料)
# Maps which primary nets feed into each secondary school
EDB_SSPA_SERVING_NET = {
    "name": "edb_sspa_serving_net",
    "publisher": "EDB",
    "dataset": "sspa_school_serving_net",
    "source_type": "admission_structure",
    "version": "2026",
    "url": "https://www.edb.gov.hk/en/edu-system/primary-secondary/spa-systems/secondary-spa/general-info/sspa-school-serving-net.html",
    "local_path": os.path.join(CSV_MOUNT_PATH, "edb", "sspa", "SSPA_SchServingNet_en.csv"),
    "format": "csv",
    "refresh_cycle": "annual",
    "credibility": 9.0,
    "description": "Secondary school serving nets — which primary nets feed into each secondary school",
}

# POA: Primary School Net (小一入學統籌辦法學校網範圍)
# Maps geographic areas to primary school nets
EDB_POA_SCHOOL_NET = {
    "name": "edb_poa_school_net",
    "publisher": "EDB",
    "dataset": "poa_school_net",
    "source_type": "admission_structure",
    "version": "2026",
    "url": "https://www.edb.gov.hk/en/edu-system/primary-secondary/spa-systems/primary-school-aa/general-info/poa-school-net.html",
    "local_path": os.path.join(CSV_MOUNT_PATH, "edb", "poa", "POA_SchoolNet_EN.csv"),
    "format": "csv",
    "refresh_cycle": "annual",
    "credibility": 9.0,
    "description": "Primary school nets — geographic areas → school nets",
}

# ── Layer 3 — School Relationship Graph (關係層) ───────────────────────
# Through-train Schools (一條龍學校名單)
EDB_THROUGH_TRAIN = {
    "name": "edb_through_train_schools",
    "publisher": "EDB",
    "dataset": "through_train_schools",
    "source_type": "school_relationship",
    "version": "2026",
    "url": "https://www.edb.gov.hk/en/edu-system/primary-secondary/applicable-to-primary-secondary/through-train-schools.html",
    "local_path": os.path.join(CSV_MOUNT_PATH, "edb", "through_train", "Through-train-schools-en.csv"),
    "format": "csv",
    "refresh_cycle": "annual",
    "credibility": 9.0,
    "description": "Through-train school relationships — primary → secondary direct linkage",
}

# ── Layer 4 — School Intelligence Profile (學校情報層) ─────────────────
# Secondary School Profiles (中學概覽)
EDB_SSP_PROFILES = {
    "name": "edb_secondary_school_profiles",
    "publisher": "EDB",
    "dataset": "secondary_school_profiles",
    "source_type": "school_profile",
    "version": "2025_2026",
    "url": "https://www.edb.gov.hk/en/student-parents/sch-info/sch-search/sch_profiles_info/secondary-sch-profiles.html",
    "local_path": os.path.join(CSV_MOUNT_PATH, "edb", "ssp", "ssp_2025_2026_en.csv"),
    "format": "csv",
    "refresh_cycle": "annual",
    "credibility": 9.0,
    "description": "Secondary school profiles — mission, curriculum, language policy",
}

# Primary School Profiles (小學概覽)
EDB_PSP_PROFILES = {
    "name": "edb_primary_school_profiles",
    "publisher": "EDB",
    "dataset": "primary_school_profiles",
    "source_type": "school_profile",
    "version": "2025",
    "url": "https://www.edb.gov.hk/en/student-parents/sch-info/sch-search/sch_profiles_info/primary-sch-profiles.html",
    "local_path": os.path.join(CSV_MOUNT_PATH, "edb", "psp", "psp_2025_en.csv"),
    "format": "csv",
    "refresh_cycle": "annual",
    "credibility": 9.0,
    "description": "Primary school profiles — mission, curriculum, language policy",
}

# Kindergarten Profiles (幼稚園及幼稚園暨幼兒中心概覽)
EDB_KGP_PROFILES = {
    "name": "edb_kindergarten_profiles",
    "publisher": "EDB",
    "dataset": "kindergarten_profiles",
    "source_type": "school_profile",
    "version": "2025",
    "url": "https://www.edb.gov.hk/en/student-parents/sch-info/sch-search/sch_profiles_info/kg-profiles.html",
    "local_path": os.path.join(CSV_MOUNT_PATH, "edb", "kgp", "KGP_2025_en.csv"),
    "format": "csv",
    "refresh_cycle": "annual",
    "credibility": 9.0,
    "description": "Kindergarten profiles — mission, curriculum, language policy",
}

# ── Layer 5 — Availability / Market Signal (供應信號) ──────────────────
# K1-K3 Vacancy Information (幼稚園幼兒班至高班學位空缺資料)
EDB_KG_VACANCY = {
    "name": "edb_kg_vacancy",
    "publisher": "EDB",
    "dataset": "kg_vacancy_information",
    "source_type": "availability_signal",
    "version": "202627",
    "url": "https://www.edb.gov.hk/en/student-parents/sch-info/sch-search/sch_profiles_info/kg-vacancy-information.html",
    "local_path": os.path.join(CSV_MOUNT_PATH, "edb", "kg_vacancy", "K1-K3_vacancy_information_en_202627.csv"),
    "format": "csv",
    "refresh_cycle": "monthly",
    "credibility": 9.0,
    "description": "Kindergarten K1-K3 vacancy status — time-sensitive market signal",
}

# ── All EDA Sources Registry ──────────────────────────────────────────
EDB_SOURCES = [
    EDB_MASTER_REGISTRY,        # Layer 1
    EDB_SSPA_SERVING_NET,       # Layer 2a
    EDB_POA_SCHOOL_NET,         # Layer 2b
    EDB_THROUGH_TRAIN,          # Layer 3
    EDB_SSP_PROFILES,           # Layer 4a
    EDB_PSP_PROFILES,           # Layer 4b
    EDB_KGP_PROFILES,           # Layer 4c
    EDB_KG_VACANCY,             # Layer 5
]

# Qdrant
QDRANT_COLLECTION = "knowledge_education_v2"
QDRANT_VECTOR_SIZE = int(os.getenv("QDRANT_VECTOR_SIZE", "1536"))
