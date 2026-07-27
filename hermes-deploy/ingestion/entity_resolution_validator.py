"""
Phase 10.2 — Entity Resolution Validator (Batch 0)

Purpose: Validate EDB school_no ↔ CHSC school_id ↔ HKET school_name mapping
         BEFORE ingesting profiles. This prevents garbage-in-garbage-out
         when building the Education Data Foundation.

Architecture:
  1. Load all EDB schools (from school_entity_master)
  2. Load all CHSC schools (from existing school_entity / Qdrant)
  3. Build cross-source mapping using multiple strategies:
     a. Exact name match (EN + ZH) + district consistency check
     b. Alias lookup (school_alias table)
     c. Fuzzy match (trigram similarity) + address matching + district consistency
  4. Generate validation report with layer-specific match rates
  5. Flag unmapped schools for manual review

Enhancements (v2):
  - Address matching: HK school names easily confused (St. Paul's variations)
  - District consistency: Additional signal to reduce false positives
  - Layer-specific match rates: KG names change most, may need separate threshold
  - Dry-run mode: Analyze only, don't write to DB

Author: Hermes Education Engine
Phase: Phase 10.2 (Batch 0 — Pre-Ingestion Validation)
"""

import asyncio
import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Optional

import asyncpg
import yaml

from ingestion.config import (
    EDB_MASTER_REGISTRY,
    CHSC_SOURCES,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =========================================================================
# Organization Aliases (Phase 10.3 v1.2.1)
# =========================================================================

def _load_organization_aliases() -> list[dict]:
    """Load organization aliases from YAML configuration."""
    # Search in multiple locations
    search_paths = [
        os.path.join(os.path.dirname(__file__), "organization_aliases.yaml"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "organization_aliases.yaml"),
        "/app/ingestion/organization_aliases.yaml",
        "/app/organization_aliases.yaml",
    ]
    for yaml_path in search_paths:
        if os.path.exists(yaml_path):
            with open(yaml_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            return data.get("organizations", [])
    logger.warning(f"Organization aliases file not found, searched: {search_paths}")
    return []


def expand_organization_alias(name: str, org_aliases: list[dict]) -> str:
    """Expand organization abbreviations in school name.

    Example:
        "PLK Laws Foundation College" → "PO LEUNG KUK Laws Foundation College"
        "TWGHs Chen Zao Men College" → "TUNG WAH GROUP OF HOSPITALS Chen Zao Men College"
    """
    if not name:
        return name

    name_upper = name.upper().strip()

    # Sort by abbreviation length (longest first) to avoid partial matches
    sorted_aliases = sorted(org_aliases, key=lambda x: len(x.get("canonical", "")), reverse=True)

    for org in sorted_aliases:
        canonical = org.get("canonical", "").upper()
        aliases = [a.upper() for a in org.get("aliases", [])]

        for alias in aliases:
            if not alias:
                continue

            # Check if name starts with alias followed by space or end of string
            if name_upper.startswith(alias):
                # Check if alias is followed by space or is the entire name
                after_alias = name_upper[len(alias):]
                if not after_alias or after_alias[0] == ' ':
                    # Replace abbreviation with canonical form
                    expanded = canonical + after_alias
                    logger.debug(f"Expanded: '{name}' → '{expanded}'")
                    return expanded

    return name


def normalize_school_name(name: str) -> str:
    """Normalize school name for matching.

    Phase 10.3 v1.2.2 improvements:
    - Remove all punctuation (periods, commas, hyphens)
    - Normalize symbols (& → AND)
    - Normalize number formats (No. 1 → NO1)
    - Extract parenthetical content as location suffix
    - Case normalization (uppercase for consistency)
    """
    if not name:
        return ""

    # Uppercase for consistent comparison
    n = name.upper().strip()

    # Extract parenthetical content (e.g., "(Kwai Chung)", "(Broadway)")
    # Keep base name separate from location suffix
    n = re.sub(r'\([^)]*\)', '', n)
    n = re.sub(r'\[[^\]]*\]', '', n)

    # Normalize symbols: & → AND
    n = n.replace('&', 'AND')

    # Normalize hyphens: remove spaces around hyphens, then remove hyphens
    # "PANG HOK-KO" → "PANG HOK KO"
    n = re.sub(r'\s*-\s*', ' ', n)

    # Remove all remaining punctuation: periods, commas, apostrophes
    n = n.replace(".", "").replace(",", "").replace("'", "")

    # Normalize number formats: "NO 1", "NO. 1", "NO.1" → "NO1"
    n = re.sub(r'\bNO\s*1\b', 'NO1', n)
    n = re.sub(r'\bNO\s*2\b', 'NO2', n)
    n = re.sub(r'\bNO\s*3\b', 'NO3', n)

    # Normalize whitespace
    n = " ".join(n.split())

    return n.strip()


# =========================================================================
# Data Models
# =========================================================================

@dataclass
class MatchScores:
    """Multi-signal match scores for entity resolution."""
    name_score: float = 0.0
    address_score: float = 0.0
    district_match: bool = False
    final_confidence: float = 0.0


@dataclass
class MatchResult:
    """Result of matching a CHSC school to EDB master."""
    chsc_school_id: str
    chsc_name_en: str
    chsc_name_zh: Optional[str]
    chsc_district: Optional[str] = None
    chsc_school_type: Optional[str] = None  # secondary / primary / kindergarten
    master_id: Optional[int] = None
    edb_school_no: Optional[str] = None
    match_method: Optional[str] = None
    confidence: float = 0.0
    scores: Optional[MatchScores] = None
    needs_review: bool = False


@dataclass
class LayerStats:
    """Match statistics per school level."""
    total: int = 0
    matched_exact: int = 0
    matched_alias: int = 0
    matched_fuzzy: int = 0
    unmatched: int = 0

    @property
    def match_rate(self) -> float:
        if self.total == 0:
            return 0.0
        return (self.matched_exact + self.matched_alias + self.matched_fuzzy) / self.total


@dataclass
class ValidationReport:
    """Complete validation report for entity resolution."""
    total_edb: int = 0
    total_chsc: int = 0
    matched_exact: int = 0
    matched_alias: int = 0
    matched_fuzzy: int = 0
    unmatched: int = 0
    needs_review: list = field(default_factory=list)
    matches: list = field(default_factory=list)
    layer_stats: dict = field(default_factory=lambda: {
        "secondary": LayerStats(),
        "primary": LayerStats(),
        "kindergarten": LayerStats(),
        "other": LayerStats(),
    })

    @property
    def match_rate(self) -> float:
        if self.total_chsc == 0:
            return 0.0
        return (self.matched_exact + self.matched_alias + self.matched_fuzzy) / self.total_chsc


# =========================================================================
# Entity Resolution Validator
# =========================================================================

class EntityResolutionValidator:
    """Validate cross-source entity mapping before profile ingestion."""

    def __init__(self, pg_pool: asyncpg.Pool, dry_run: bool = True):
        self.pool = pg_pool
        self.dry_run = dry_run

    async def validate(self) -> ValidationReport:
        """Run full validation pipeline."""
        report = ValidationReport()

        # Step 1: Load EDB masters
        edb_masters = await self._load_edb_masters()
        report.total_edb = len(edb_masters)
        logger.info(f"Loaded {report.total_edb} EDB masters")

        # Step 2: Load CHSC schools
        chsc_schools = await self._load_chsc_schools()
        report.total_chsc = len(chsc_schools)
        logger.info(f"Loaded {report.total_chsc} CHSC schools")

        # Step 3: Load existing mappings
        existing_mappings = await self._load_existing_mappings()

        # Step 4: Match each CHSC school to EDB master
        for chsc in chsc_schools:
            # Skip if already mapped
            if chsc["school_id"] in existing_mappings:
                continue

            result = await self._match_school(chsc, edb_masters)
            # DEBUG: Log first few matches
            if report.total_chsc <= 5 or chsc["school_id"] in ["SCH-00010", "SCH-00011", "SCH-00012"]:
                logger.info(f"[DEBUG] CHSC {chsc['school_id']}: name={chsc.get('name')!r}, name_zh={chsc.get('name_zh')!r}, match_method={result.match_method}")
            report.matches.append(result)

            # Update layer-specific stats
            layer = self._classify_layer(chsc)
            report.layer_stats[layer].total += 1

            if result.match_method and result.match_method.startswith("exact"):
                report.matched_exact += 1
                report.layer_stats[layer].matched_exact += 1
            elif result.match_method == "alias":
                report.matched_alias += 1
                report.layer_stats[layer].matched_alias += 1
            elif result.match_method == "fuzzy":
                report.matched_fuzzy += 1
                report.layer_stats[layer].matched_fuzzy += 1
            else:
                report.unmatched += 1
                report.layer_stats[layer].unmatched += 1

            if result.needs_review:
                report.needs_review.append(result)

        # Step 5: Log summary
        self._log_summary(report)

        return report

    def _classify_layer(self, chsc: dict) -> str:
        """Classify school into layer by type.

        Note: CHSC data uses school_type for finance type (Aided/DSS/Government/Caput),
        not school level. Since source_name='chsc_secondary_csv' is always secondary,
        we default to "secondary" for CHSC schools.
        """
        school_type = (chsc.get("school_type") or "").lower()
        source_name = (chsc.get("source_name") or "").lower()

        # CHSC secondary CSV is always secondary schools
        if "chsc_secondary" in source_name:
            return "secondary"

        # Fallback: check school_type for level keywords
        if "secondary" in school_type or "中學" in school_type:
            return "secondary"
        elif "primary" in school_type or "小學" in school_type:
            return "primary"
        elif "kindergarten" in school_type or "幼稚園" in school_type or "kg" in school_type:
            return "kindergarten"
        return "other"

    def _log_summary(self, report: ValidationReport) -> None:
        """Log validation summary with layer-specific stats."""
        logger.info("=" * 60)
        logger.info("ENTITY RESOLUTION VALIDATION REPORT")
        logger.info("=" * 60)
        logger.info(f"Mode:               {'DRY-RUN (no writes)' if self.dry_run else 'WRITE'}")
        logger.info(f"EDB Masters:        {report.total_edb}")
        logger.info(f"CHSC Schools:       {report.total_chsc}")
        # Three clear metrics: Exact, Resolved (Exact + Fuzzy), Unresolved
        resolved = report.matched_exact + report.matched_alias + report.matched_fuzzy
        logger.info(f"Exact Matched:      {report.matched_exact}")
        logger.info(f"Resolved (total):   {resolved} (exact + alias + fuzzy)")
        logger.info(f"Unresolved:         {report.unmatched}")
        logger.info(f"Overall Match Rate: {report.match_rate:.1%}")
        logger.info("-" * 60)
        logger.info("LAYER-SPECIFIC MATCH RATES")
        logger.info("-" * 60)
        for layer, stats in report.layer_stats.items():
            if stats.total > 0:
                layer_resolved = stats.matched_exact + stats.matched_alias + stats.matched_fuzzy
                logger.info(f"  {layer:15s}: {stats.match_rate:.1%} ({layer_resolved}/{stats.total}, exact={stats.matched_exact}, fuzzy={stats.matched_fuzzy})")
            else:
                logger.info(f"  {layer:15s}: NO_DATA")
        logger.info("-" * 60)
        logger.info(f"Needs Review:       {len(report.needs_review)}")
        logger.info("=" * 60)

    async def _load_edb_masters(self) -> list[dict]:
        """Load all EDB master records with address and Chinese name for matching."""
        rows = await self.pool.fetch("""
            SELECT id, edb_school_no, school_name_en, school_name_zh,
                   district, school_level, address_en, address_zh
            FROM memory.school_entity_master
            WHERE source = 'EDB'
        """)
        return [dict(r) for r in rows]

    async def _load_chsc_schools(self) -> list[dict]:
        """Load all CHSC schools from existing school_entity table."""
        # CHSC data lives in school_entity (v2 schema) with source_name='chsc_secondary_csv'
        rows = await self.pool.fetch("""
            SELECT school_id, canonical_name AS name, district, school_type, source_name,
                   school_name_zh AS name_zh
            FROM memory.school_entity
            WHERE source_name = 'chsc_secondary_csv'
        """)
        return [dict(r) for r in rows]

    async def _load_existing_mappings(self) -> dict[str, int]:
        """Load existing EDB ↔ CHSC mappings."""
        rows = await self.pool.fetch("""
            SELECT source_school_id, school_master_id
            FROM memory.school_entity_mapping
            WHERE source_system = 'CHSC'
        """)
        return {r["source_school_id"]: r["school_master_id"] for r in rows}

    async def _match_school(
        self,
        chsc: dict,
        edb_masters: list[dict],
    ) -> MatchResult:
        """Match a CHSC school to EDB master using multi-stage strategies.

        Entity Resolution v1.3.0 — Bilingual Entity Matching

        Stage 1: EDB school_no (if available)
        Stage 2: Chinese name exact match (highest priority for bilingual matching)
        Stage 3: Chinese name normalized match
        Stage 4: English name exact match + district consistency
        Stage 5: English name normalized match
        Stage 6: Alias match (bilingual)
        Stage 7: Fuzzy match (trigram) + address + district
        """
        result = MatchResult(
            chsc_school_id=chsc["school_id"],
            chsc_name_en=chsc.get("name", ""),
            chsc_name_zh=chsc.get("name_zh"),
            chsc_district=chsc.get("district"),
            chsc_school_type=chsc.get("school_type"),
        )

        # Pre-compute normalized names for both CHSC and EDB
        org_aliases = _load_organization_aliases()

        # CHSC names
        chsc_name_expanded = expand_organization_alias(chsc.get("name", ""), org_aliases)
        chsc_name_normalized = normalize_school_name(chsc_name_expanded)
        chsc_zh_normalized = normalize_school_name(chsc.get("name_zh", "") or "")

        # EDB masters with normalized names
        edb_masters_normalized = []
        for edb in edb_masters:
            edb_norm = dict(edb)
            edb_expanded = expand_organization_alias(edb.get("school_name_en", ""), org_aliases)
            edb_norm["_normalized_name"] = normalize_school_name(edb_expanded)
            edb_norm["_normalized_zh"] = normalize_school_name(edb.get("school_name_zh", "") or "")
            edb_masters_normalized.append(edb_norm)

        # Stage 1: EDB school_no (if available from existing mapping)
        if chsc.get("edb_school_no"):
            for edb in edb_masters_normalized:
                if edb.get("edb_school_no") == chsc["edb_school_no"]:
                    result.master_id = edb["id"]
                    result.edb_school_no = edb["edb_school_no"]
                    result.match_method = "school_no"
                    result.confidence = 1.0
                    result.scores = MatchScores(
                        name_score=1.0,
                        district_match=True,
                        final_confidence=1.0,
                    )
                    return result

        # Stage 2: Chinese name exact match (highest priority after school_no)
        # Chinese names are more stable and consistent between EDB and CHSC
        if chsc.get("name_zh") and chsc["name_zh"].strip():
            chsc_zh = chsc["name_zh"].strip()
            for edb in edb_masters_normalized:
                edb_zh = edb.get("school_name_zh", "")
                if edb_zh and chsc_zh == edb_zh:
                    district_match = self._districts_match(
                        chsc.get("district"), edb.get("district")
                    )
                    result.master_id = edb["id"]
                    result.edb_school_no = edb["edb_school_no"]
                    result.match_method = "exact_name_zh"
                    result.confidence = 0.99 if district_match else 0.95
                    result.scores = MatchScores(
                        name_score=1.0,
                        district_match=district_match,
                        final_confidence=result.confidence,
                    )
                    if not district_match:
                        result.needs_review = True
                    return result

        # Stage 3: Chinese name normalized match
        if chsc_zh_normalized:
            for edb in edb_masters_normalized:
                edb_zh = edb.get("_normalized_zh", "")
                if edb_zh and chsc_zh_normalized == edb_zh:
                    district_match = self._districts_match(
                        chsc.get("district"), edb.get("district")
                    )
                    result.master_id = edb["id"]
                    result.edb_school_no = edb["edb_school_no"]
                    result.match_method = "normalized_name_zh"
                    result.confidence = 0.97 if district_match else 0.93
                    result.scores = MatchScores(
                        name_score=1.0,
                        district_match=district_match,
                        final_confidence=result.confidence,
                    )
                    if not district_match:
                        result.needs_review = True
                    return result

        # Stage 4: Exact English name match + district consistency
        for edb in edb_masters_normalized:
            edb_normalized = edb.get("_normalized_name", "")
            if chsc_name_normalized and edb_normalized and chsc_name_normalized == edb_normalized:
                district_match = self._districts_match(
                    chsc.get("district"), edb.get("district")
                )
                result.master_id = edb["id"]
                result.edb_school_no = edb["edb_school_no"]
                result.match_method = "exact_name_en"
                result.confidence = 0.98 if district_match else 0.90
                result.scores = MatchScores(
                    name_score=1.0,
                    district_match=district_match,
                    final_confidence=result.confidence,
                )
                if not district_match:
                    result.needs_review = True
                return result

        # Stage 5: Alias lookup (bilingual)
        alias_match = await self._lookup_alias_bilingual(
            chsc.get("name", ""), chsc.get("name_zh")
        )
        if alias_match:
            result.master_id = alias_match["master_id"]
            result.match_method = "alias"
            result.confidence = alias_match.get("confidence", 0.85)
            return result

        # Stage 5: Fuzzy match (trigram) + address + district
        fuzzy_match = await self._fuzzy_match_with_signals(chsc)
        if fuzzy_match:
            result.master_id = fuzzy_match["master_id"]
            result.match_method = "fuzzy"
            result.scores = fuzzy_match["scores"]
            result.confidence = fuzzy_match["scores"].final_confidence
            result.needs_review = True
            return result

        # No match found
        result.match_method = None
        result.confidence = 0.0
        result.needs_review = True
        return result

    def _names_equal(self, name1: str, name2: str) -> bool:
        """Compare two school names (case-insensitive, whitespace-normalized)."""
        if not name1 or not name2:
            return False
        n1 = " ".join(name1.lower().split())
        n2 = " ".join(name2.lower().split())
        return n1 == n2

    def _districts_match(self, district1: Optional[str], district2: Optional[str]) -> bool:
        """Check if two district names match (handles variations)."""
        if not district1 or not district2:
            return False
        # Normalize district names
        d1 = district1.lower().strip().replace(" ", "")
        d2 = district2.lower().strip().replace(" ", "")
        # Handle common variations
        district_aliases = {
            "kowlooncity": ["kowlooncity", "kc"],
            "kowloon": ["kowlooncity", "kc"],
            "hongkong": ["hk", "hongkongisland"],
            "saikung": ["saikungdistrict"],
            "yuenlong": ["yuenlongdistrict"],
        }
        if d1 == d2:
            return True
        for canonical, aliases in district_aliases.items():
            if d1 in aliases and d2 in aliases:
                return True
        return False

    def _addresses_match(self, addr1: Optional[str], addr2: Optional[str]) -> float:
        """Calculate address similarity score (0.0-1.0)."""
        if not addr1 or not addr2:
            return 0.0
        # Normalize addresses
        a1 = addr1.lower().strip().replace(" ", "").replace(",", "")
        a2 = addr2.lower().strip().replace(" ", "").replace(",", "")
        # Exact match
        if a1 == a2:
            return 1.0
        # Partial match (one contains the other)
        if a1 in a2 or a2 in a1:
            return 0.8
        # Street number match (e.g., "123 main st" vs "123 main road")
        import re
        num1 = re.match(r"(\d+)", a1)
        num2 = re.match(r"(\d+)", a2)
        if num1 and num2 and num1.group(1) == num2.group(1):
            return 0.6
        return 0.0

    async def _lookup_alias_bilingual(
        self, name_en: Optional[str], name_zh: Optional[str]
    ) -> Optional[dict]:
        """Lookup school alias in school_alias table (bilingual)."""
        # Try English name first
        if name_en:
            row = await self.pool.fetchrow("""
                SELECT school_id as master_id, alias_type, confidence, locale
                FROM memory.school_alias
                WHERE alias = $1 AND locale = 'en'
                ORDER BY confidence DESC
                LIMIT 1
            """, name_en)
            if row:
                return dict(row)

        # Try Chinese name
        if name_zh:
            row = await self.pool.fetchrow("""
                SELECT school_id as master_id, alias_type, confidence, locale
                FROM memory.school_alias
                WHERE alias = $1 AND locale = 'zh-HK'
                ORDER BY confidence DESC
                LIMIT 1
            """, name_zh)
            if row:
                return dict(row)

        return None

    async def _fuzzy_match_with_signals(self, chsc: dict) -> Optional[dict]:
        """Fuzzy match using pg_trgm + address + district signals."""
        row = await self.pool.fetchrow("""
            SELECT id as master_id, edb_school_no,
                   similarity(school_name_en, $1) as name_sim,
                   address_en, address_zh, district
            FROM memory.school_entity_master
            WHERE school_name_en % $1  -- trigram similarity operator
            ORDER BY similarity(school_name_en, $1) DESC
            LIMIT 1
        """, chsc.get("name", ""))

        if not row or row["name_sim"] < 0.5:  # 50% similarity threshold
            return None

        # Calculate multi-signal scores
        name_score = row["name_sim"]
        address_score = self._addresses_match(
            chsc.get("address"), row["address_en"]
        )
        district_match = self._districts_match(
            chsc.get("district"), row["district"]
        )

        # Weighted final confidence
        # Name: 60%, Address: 25%, District: 15%
        final_confidence = (
            name_score * 0.60 +
            address_score * 0.25 +
            (1.0 if district_match else 0.0) * 0.15
        )

        # Require minimum confidence
        if final_confidence < 0.4:
            return None

        return {
            "master_id": row["master_id"],
            "edb_school_no": row["edb_school_no"],
            "scores": MatchScores(
                name_score=name_score,
                address_score=address_score,
                district_match=district_match,
                final_confidence=final_confidence,
            ),
        }


# =========================================================================
# Report Generator
# =========================================================================

def generate_report(report: ValidationReport, output_path: str) -> None:
    """Generate JSON validation report."""
    data = {
        "summary": {
            "total_edb": report.total_edb,
            "total_chsc": report.total_chsc,
            "matched_exact": report.matched_exact,
            "matched_alias": report.matched_alias,
            "matched_fuzzy": report.matched_fuzzy,
            "unmatched": report.unmatched,
            "match_rate": report.match_rate,
            "needs_review_count": len(report.needs_review),
        },
        "layer_specific": {
            layer: {
                "total": stats.total,
                "matched_exact": stats.matched_exact,
                "matched_alias": stats.matched_alias,
                "matched_fuzzy": stats.matched_fuzzy,
                "unmatched": stats.unmatched,
                "match_rate": stats.match_rate,
            }
            for layer, stats in report.layer_stats.items()
            if stats.total > 0
        },
        "thresholds": {
            "overall": {"pass": 0.95, "warn": 0.85, "fail": 0.0},
            "secondary": {"pass": 0.98, "warn": 0.90, "fail": 0.0},
            "primary": {"pass": 0.95, "warn": 0.85, "fail": 0.0},
            "kindergarten": {"pass": 0.90, "warn": 0.80, "fail": 0.0},
        },
        "needs_review": [
            {
                "chsc_school_id": r.chsc_school_id,
                "chsc_name_en": r.chsc_name_en,
                "chsc_name_zh": r.chsc_name_zh,
                "chsc_district": r.chsc_district,
                "matched_master_id": r.master_id,
                "edb_school_no": r.edb_school_no,
                "match_method": r.match_method,
                "confidence": r.confidence,
                "scores": {
                    "name_score": r.scores.name_score,
                    "address_score": r.scores.address_score,
                    "district_match": r.scores.district_match,
                    "final_confidence": r.scores.final_confidence,
                } if r.scores else None,
            }
            for r in report.needs_review
        ],
        "all_matches": [
            {
                "chsc_school_id": r.chsc_school_id,
                "chsc_name_en": r.chsc_name_en,
                "master_id": r.master_id,
                "edb_school_no": r.edb_school_no,
                "match_method": r.match_method,
                "confidence": r.confidence,
            }
            for r in report.matches
        ],
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    logger.info(f"Report saved to: {output_path}")


# =========================================================================
# CLI Entry Point
# =========================================================================

async def main():
    """Run entity resolution validation."""
    import argparse

    parser = argparse.ArgumentParser(description="Entity Resolution Validator (Batch 0)")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Analyze only, don't write to DB (default: True)",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        default=False,
        help="Write mappings to DB (default: dry-run)",
    )
    args = parser.parse_args()

    dry_run = not args.write

    # Connect to PostgreSQL
    pg_pool = await asyncpg.create_pool(
        host=os.getenv("POSTGRES_HOST", "hermes-postgres"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "hermes"),
        user=os.getenv("POSTGRES_USER", "hermes"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
    )

    try:
        validator = EntityResolutionValidator(pg_pool, dry_run=dry_run)
        report = await validator.validate()

        # Generate report (write to /app/ which is writable)
        output_path = os.path.join(
            os.getenv("REPORT_OUTPUT_PATH", "/app"),
            "entity_resolution_report.json",
        )
        generate_report(report, output_path)

        # Exit code based on match rate (with layer-specific checks)
        overall_pass = report.match_rate >= 0.95
        secondary_pass = report.layer_stats["secondary"].match_rate >= 0.98
        primary_pass = report.layer_stats["primary"].match_rate >= 0.95
        kg_pass = report.layer_stats["kindergarten"].match_rate >= 0.90

        if overall_pass and secondary_pass and primary_pass and kg_pass:
            logger.info("✅ PASS: All layers meet thresholds")
            logger.info(f"   Overall:      {report.match_rate:.1%} (>= 95%)")
            logger.info(f"   Secondary:    {report.layer_stats['secondary'].match_rate:.1%} (>= 98%)")
            logger.info(f"   Primary:      {report.layer_stats['primary'].match_rate:.1%} (>= 95%)")
            logger.info(f"   Kindergarten: {report.layer_stats['kindergarten'].match_rate:.1%} (>= 90%)")
        else:
            logger.warning("⚠️  WARN: Some layers below threshold")
            if not overall_pass:
                logger.warning(f"   Overall:      {report.match_rate:.1%} (need >= 95%)")
            if not secondary_pass:
                logger.warning(f"   Secondary:    {report.layer_stats['secondary'].match_rate:.1%} (need >= 98%)")
            if not primary_pass:
                logger.warning(f"   Primary:      {report.layer_stats['primary'].match_rate:.1%} (need >= 95%)")
            if not kg_pass:
                logger.warning(f"   Kindergarten: {report.layer_stats['kindergarten'].match_rate:.1%} (need >= 90%)")
            exit(1)

    finally:
        await pg_pool.close()


if __name__ == "__main__":
    asyncio.run(main())