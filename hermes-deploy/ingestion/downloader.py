# Hermes Ingestion — CSV Downloader
# Downloads CHSC CSV files, computes checksums, and parses rows.
# IMPORTANT: Docker containers cannot reach the internet on this NAS.
# CSVs must be pre-downloaded to the mounted cold-storage path.

import csv
import hashlib
import io
import logging
from pathlib import Path
from typing import Optional

from config import CHSC_SOURCES
from models import RawSchoolRecord

logger = logging.getLogger("hermes.ingestion.downloader")


def compute_checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_csv_from_disk(path: str) -> tuple[str, bytes]:
    """Read CSV file from mounted cold storage. Returns (checksum, raw_bytes)."""
    filepath = Path(path)
    if not filepath.exists():
        raise FileNotFoundError(f"CSV not found at {filepath}. Pre-download to cold storage first.")
    data = filepath.read_bytes()
    return compute_checksum(data), data


def parse_csv_rows(data: bytes) -> list[dict]:
    """Parse CSV bytes into a list of dicts, one per school row."""
    text = data.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        stripped = {k.strip(): v.strip() if isinstance(v, str) else v for k, v in row.items()}
        rows.append(stripped)
    logger.info("Parsed %d rows from CSV", len(rows))
    return rows


def download_source(source_config: dict) -> list[RawSchoolRecord]:
    """Download one CHSC CSV source, parse it, return raw records."""
    logger.info("Reading %s from %s", source_config["version"], source_config["local_path"])
    checksum, data = read_csv_from_disk(source_config["local_path"])
    rows = parse_csv_rows(data)

    records = []
    for row in rows:
        records.append(RawSchoolRecord(
            source_name=source_config["name"],
            source_version=source_config["version"],
            source_url=source_config["url"],
            checksum=checksum,
            raw_data=row,
        ))
    logger.info("Prepared %d raw records for %s", len(records), source_config["version"])
    return records


def download_all() -> dict[str, list[RawSchoolRecord]]:
    """Read all configured CHSC sources from cold storage. Returns {version: [records]}."""
    results = {}
    for source in CHSC_SOURCES:
        path = source["local_path"]
        if not Path(path).exists():
            logger.warning("CSV not found, skipping: %s", path)
            continue
        results[source["version"]] = download_source(source)
    return results
