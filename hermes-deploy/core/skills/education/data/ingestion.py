# Education Data Layer — Ingestion Pipeline
# Raw data → Parser → Normalizer → Entity Resolution → Dual Write

import json
import os
import csv
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Raw storage root on NAS
RAW_ROOT = "/data/education/raw"
PROCESSED_ROOT = "/data/education/processed"
ARCHIVE_ROOT = "/data/education/archive"


class RawCollector:
    """Download raw data from sources. Stores verbatim without modification."""

    def __init__(self, raw_root: str = RAW_ROOT):
        self.root = Path(raw_root)

    def save_raw(self, source: str, filename: str, content: str | bytes) -> Path:
        """Save raw data to source subdirectory. Returns path."""
        source_dir = self.root / source
        source_dir.mkdir(parents=True, exist_ok=True)
        path = source_dir / filename
        mode = "wb" if isinstance(content, bytes) else "w"
        encoding = None if isinstance(content, bytes) else "utf-8"
        with open(path, mode, encoding=encoding) as f:
            f.write(content)
        return path

    def list_raw(self, source: str) -> list[Path]:
        """List all raw files for a source."""
        source_dir = self.root / source
        if not source_dir.exists():
            return []
        return sorted(source_dir.iterdir())


class CSVParser:
    """Parse CSV files into normalized dict records."""

    def parse(self, filepath: Path, column_map: dict[str, str] | None = None) -> list[dict]:
        """Parse CSV, optionally remapping columns. Returns list of dicts."""
        records = []
        with open(filepath, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if column_map:
                    record = {column_map.get(k, k): v for k, v in row.items()}
                else:
                    record = dict(row)
                records.append(record)
        return records


class JSONParser:
    """Parse JSON files into normalized dict records."""

    def parse(self, filepath: Path) -> list[dict]:
        """Parse JSON file. Handles both array and object-with-records-key formats."""
        with open(filepath, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for key in ("records", "data", "schools", "results"):
                if key in data:
                    return data[key]
            return [data]
        return []


class EntityResolver:
    """Resolve different names/spellings to canonical school IDs."""

    def __init__(self):
        self._alias_map: dict[str, str] = {}       # alias → school_id
        self._canonical: dict[str, dict] = {}      # school_id → canonical record
        self._next_id: int = 1

    def load_aliases(self, aliases: list[dict]):
        """Load existing aliases from database."""
        for a in aliases:
            key = (a["alias_name"] or "").lower().strip()
            self._alias_map[key] = a["school_id"]

    def resolve(self, name_en: str = "", name_zh: str = "",
                district: str = "", school_type: str = "",
                source: str = "unknown") -> Optional[str]:
        """
        Try to resolve a school name to canonical ID.
        Returns existing ID, or None if new (caller should register).
        """
        # Exact match on alias map
        for name in (name_en, name_zh):
            key = (name or "").lower().strip()
            if key and key in self._alias_map:
                return self._alias_map[key]

        # Fuzzy — strip common suffixes and retry
        for name in (name_en, name_zh):
            if not name:
                continue
            key = (name
                   .replace("College", "").replace("School", "")
                   .replace("中學", "").replace("小學", "").replace("書院", "")
                   .replace("幼稚園", "")
                   .strip().lower())
            if key and key in self._alias_map:
                return self._alias_map[key]

        return None

    def register(self, name_en: str, name_zh: str, school_type: str,
                 school_level: str, gender: str = "co_ed") -> str:
        """Register a new canonical school. Returns school_id."""
        school_id = f"SCH{self._next_id:05d}"
        self._next_id += 1

        record = {
            "school_id": school_id,
            "canonical_name_en": name_en,
            "canonical_name_zh": name_zh,
            "school_type": school_type,
            "school_level": school_level,
            "gender": gender,
        }
        self._canonical[school_id] = record

        # Register aliases
        for name in (name_en, name_zh):
            key = (name or "").lower().strip()
            if key:
                self._alias_map[key] = school_id

        return school_id

    def add_alias(self, school_id: str, alias: str):
        """Add an additional alias for an existing school."""
        key = (alias or "").lower().strip()
        if key:
            self._alias_map[key] = school_id

    @property
    def canonical_schools(self) -> list[dict]:
        return list(self._canonical.values())


class Normalizer:
    """Normalize raw records into canonical school model fields."""

    @staticmethod
    def normalize_school(raw: dict, source: str) -> dict:
        """Normalize a raw school record from any source into canonical fields."""
        return {
            "name_en": Normalizer._first(raw, ["name_en", "school_name_en", "english_name",
                                                "SCHOOL_NAME_EN", "name_english"]),
            "name_zh": Normalizer._first(raw, ["name_zh", "school_name_zh", "chinese_name",
                                                "SCHOOL_NAME_ZH", "name_chinese", "學校名稱"]),
            "school_type": Normalizer._map_school_type(raw, source),
            "school_level": Normalizer._map_level(raw, source),
            "gender": Normalizer._map_gender(raw),
            "district": Normalizer._first(raw, ["district", "DISTRICT", "area", "地區"]),
            "address_en": Normalizer._first(raw, ["address_en", "address", "ADDRESS_EN"]),
            "address_zh": Normalizer._first(raw, ["address_zh", "ADDRESS_ZH", "地址"]),
            "band": Normalizer._first(raw, ["band", "school_band", "BAND"]),
            "language_medium": Normalizer._first(raw, ["language", "language_medium",
                                                        "medium_of_instruction", "教學語言"]),
            "religion": Normalizer._first(raw, ["religion", "religious_affiliation", "宗教"]),
            "phone": Normalizer._first(raw, ["phone", "tel", "telephone", "電話"]),
            "email": Normalizer._first(raw, ["email", "EMAIL"]),
            "website": Normalizer._first(raw, ["website", "url", "WEBSITE"]),
            "annual_fee": Normalizer._parse_fee(raw),
            "total_places": Normalizer._parse_int(raw, ["total_places", "places", "學額"]),
            "source": source,
        }

    @staticmethod
    def _first(raw: dict, keys: list[str]) -> str:
        for k in keys:
            val = raw.get(k)
            if val and str(val).strip():
                return str(val).strip()
        return ""

    @staticmethod
    def _parse_int(raw: dict, keys: list[str]) -> int | None:
        for k in keys:
            val = raw.get(k)
            if val is not None:
                try:
                    return int(val)
                except (ValueError, TypeError):
                    pass
        return None

    @staticmethod
    def _parse_fee(raw: dict) -> float:
        for k in ["annual_fee", "fee", "school_fee", "tuition", "學費"]:
            val = raw.get(k)
            if val is not None:
                try:
                    return float(str(val).replace(",", "").replace("$", "").replace("HKD", ""))
                except (ValueError, TypeError):
                    pass
        return 0.0

    @staticmethod
    def _map_school_type(raw: dict, source: str) -> str:
        val = str(raw.get("school_type", raw.get("type", ""))).lower()
        type_map = {
            "government": "government", "govt": "government", "官立": "government",
            "aided": "aided", "subsidized": "aided", "資助": "aided",
            "dss": "direct_subsidy_scheme", "direct subsidy scheme": "direct_subsidy_scheme",
            "直資": "direct_subsidy_scheme",
            "private": "private", "私立": "private",
            "international": "international", "國際": "international",
        }
        for k, v in type_map.items():
            if k in val:
                return v
        return val or "unknown"

    @staticmethod
    def _map_level(raw: dict, source: str) -> str:
        val = str(raw.get("school_level", raw.get("level", ""))).lower()
        if any(w in val for w in ["kindergarten", "kg", "幼稚園"]):
            return "kindergarten"
        if any(w in val for w in ["primary", "小學"]):
            return "primary"
        if any(w in val for w in ["secondary", "中學"]):
            return "secondary"
        return val or "unknown"

    @staticmethod
    def _map_gender(raw: dict) -> str:
        val = str(raw.get("gender", raw.get("GENDER", ""))).lower()
        if any(w in val for w in ["boy", "boys", "男"]):
            return "boys_only"
        if any(w in val for w in ["girl", "girls", "女"]):
            return "girls_only"
        return "co_ed"


class IngestionPipeline:
    """Orchestrates the full ingestion flow for a single source."""

    def __init__(self, resolver: EntityResolver):
        self.collector = RawCollector()
        self.csv_parser = CSVParser()
        self.json_parser = JSONParser()
        self.normalizer = Normalizer()
        self.resolver = resolver

    async def run(self, source: str, dry_run: bool = False) -> dict:
        """
        Run ingestion for a source. Returns summary.
        Steps: collect → parse → normalize → resolve → dual-write
        """
        raw_files = self.collector.list_raw(source)
        if not raw_files:
            return {"source": source, "status": "no_files", "schools": 0}

        all_records = []
        for fp in raw_files:
            if fp.suffix.lower() == ".csv":
                records = self.csv_parser.parse(fp)
            elif fp.suffix.lower() == ".json":
                records = self.json_parser.parse(fp)
            else:
                continue
            all_records.extend(records)

        normalized = []
        for rec in all_records:
            norm = self.normalizer.normalize_school(rec, source)
            if norm["name_en"] or norm["name_zh"]:
                normalized.append(norm)

        resolved = []
        new_count = 0
        for norm in normalized:
            existing_id = self.resolver.resolve(
                name_en=norm["name_en"], name_zh=norm["name_zh"],
                district=norm["district"], source=source,
            )
            if existing_id:
                norm["school_id"] = existing_id
            else:
                norm["school_id"] = self.resolver.register(
                    name_en=norm["name_en"], name_zh=norm["name_zh"],
                    school_type=norm["school_type"], school_level=norm["school_level"],
                    gender=norm["gender"],
                )
                new_count += 1
            resolved.append(norm)

        return {
            "source": source,
            "status": "ok",
            "raw_files": len(raw_files),
            "records_found": len(all_records),
            "normalized": len(normalized),
            "new_schools": new_count,
            "total_resolved": len(resolved),
            "schools": resolved,
        }
