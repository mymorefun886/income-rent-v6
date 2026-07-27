# Hermes Ingestion — Data Models

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class RawSchoolRecord:
    """A single row from a CHSC CSV, stored as raw JSON."""
    source_name: str
    source_version: str
    source_url: str
    checksum: str
    raw_data: dict
    ingested_at: Optional[str] = None


@dataclass
class SchoolEntity:
    """Canonical school identity."""
    school_id: str
    canonical_name: str
    district: str = ""
    school_type: str = ""
    student_gender: str = ""
    source_name: str = ""
    source_version: str = ""


@dataclass
class SchoolAttribute:
    """Key-value attribute attached to a school entity."""
    school_id: str
    attr_key: str
    attr_value: str
    attr_group: str = ""


@dataclass
class SchoolIdentityEntry:
    """Name variant mapping to canonical school_id."""
    school_id: str
    language: str
    name: str
    normalized_name: str
    source: str = ""
    confidence: float = 1.0


@dataclass
class IngestionRun:
    """Metadata about an ingestion pipeline run."""
    run_id: str
    source_name: str
    source_version: str
    raw_rows: int = 0
    entities_created: int = 0
    entities_updated: int = 0
    entities_skipped: int = 0
    qdrant_synced: int = 0
    errors: list = field(default_factory=list)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


@dataclass
class IngestionStatus:
    """Aggregated status of all ingestion runs."""
    last_run: Optional[dict] = None
    total_schools: int = 0
    total_attributes: int = 0
    identity_entries: int = 0
    raw_records: int = 0
    collections: dict = field(default_factory=dict)
