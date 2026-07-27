# Education Data Layer — Evidence Tracer
# Every recommendation factor must have a traceable source.
# This is what separates Hermes from a generic LLM school search.
#
# Phase 10.2: Per-field source tracking (field_sources dict)
# Each field can have its own source (e.g., district from EDB, academic from CHSC)

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


@dataclass
class EvidenceTrace:
    """A single piece of evidence linked to a source."""
    factor: str                    # district, band, fee, language, curriculum, etc.
    value: str                     # the actual value (e.g., "Band 1A", "Kowloon City")
    source_id: str                 # EDB, CHSC, KGP, HKET
    source_name: str               # Human-readable source name
    credibility: float = 5.0       # 1-10 source credibility score
    evidence_url: str = ""
    evidence_text: str = ""


@dataclass
class RecommendationEvidence:
    """Complete evidence chain for one school recommendation."""
    school_id: str
    school_name: str
    total_score: float = 0.0
    traces: list[EvidenceTrace] = field(default_factory=list)

    def format_for_response(self) -> str:
        """Render evidence chain as readable text."""
        if not self.traces:
            return f"\n{self.school_name}:\n  (no evidence available)"

        lines = [f"\n{self.school_name} (score: {self.total_score:.2f}):"]
        for t in self.traces:
            cred = "★" * min(5, int(t.credibility // 2))
            source_info = f"{t.source_name} [{cred}]"
            detail = t.evidence_text[:120] if t.evidence_text else f"{t.factor} = {t.value}"
            lines.append(f"  [{t.factor}] {detail}")
            lines.append(f"       Source: {source_info}")
        return "\n".join(lines)


class EvidenceTracer:
    """Builds and manages evidence traces for recommendations."""

    def __init__(self):
        self._sources: dict[str, dict] = {}

    def register_source(self, source_id: str, name: str, source_type: str,
                         credibility: float = 5.0, url: str = ""):
        self._sources[source_id] = {
            "name": name, "type": source_type, "credibility": credibility, "url": url,
        }

    def trace(self, school_id: str, school_name: str, factor: str, value: str,
              source_id: str) -> EvidenceTrace:
        """Create a single evidence trace."""
        src = self._sources.get(source_id, {"name": source_id, "credibility": 3.0})
        return EvidenceTrace(
            factor=factor,
            value=str(value),
            source_id=source_id,
            source_name=src.get("name", source_id),
            credibility=src.get("credibility", 3.0),
            evidence_url=src.get("url", ""),
        )

    def build_chain(self, school_id: str, school_name: str, total_score: float,
                    school_data: dict, detail_data: dict | None = None,
                    field_sources: dict | None = None) -> RecommendationEvidence:
        """Build a complete evidence chain from school structured data.

        Phase 10.2: Per-field source tracking via field_sources dict.
        Each field can have its own source (e.g., district from EDB, academic from CHSC).

        Args:
            school_id: School identifier.
            school_name: School display name.
            total_score: Computed ranking score.
            school_data: Qdrant payload dict with school attributes.
            detail_data: Optional additional detail dict (legacy v1 schema).
            field_sources: Optional {field_name: source_id} mapping.
                Example: {"district": "EDB", "academic_signal_stem": "CHSC", "website": "EDB"}
                Falls back to school-level source if field not in mapping.

        Returns:
            RecommendationEvidence with traces.
        """
        chain = RecommendationEvidence(
            school_id=school_id, school_name=school_name, total_score=total_score,
        )

        # Default: use school-level source from payload
        default_source = school_data.get("source", "CHSC")
        field_sources = field_sources or {}

        # Helper: resolve source for a field
        def resolve_source(field_name: str, fallback: str = None) -> str:
            src = field_sources.get(field_name, fallback or default_source)
            return src if src in self._sources else (fallback or "CHSC")

        # District evidence (typically from EDB)
        district = school_data.get("district", "") or (detail_data or {}).get("district", "")
        if district:
            source_id = resolve_source("district", "EDB")
            chain.traces.append(self.trace(school_id, school_name, "district", district, source_id))

        # School type evidence (typically from EDB)
        school_type = school_data.get("school_type", "") or school_data.get("type", "")
        if school_type:
            source_id = resolve_source("school_type", "EDB")
            chain.traces.append(self.trace(school_id, school_name, "school_type", school_type, source_id))

        # Gender evidence (typically from EDB)
        gender = school_data.get("student_gender", "")
        if gender:
            source_id = resolve_source("student_gender", "EDB")
            chain.traces.append(self.trace(school_id, school_name, "student_gender", gender, source_id))

        # ── Phase 10.2: Geo coordinates evidence (EDB) ────────────────────
        if school_data.get("latitude") and school_data.get("longitude"):
            source_id = resolve_source("coordinates", "EDB")
            chain.traces.append(self.trace(
                school_id, school_name, "coordinates",
                f"({school_data['latitude']}, {school_data['longitude']})",
                source_id
            ))

        # ── Phase 10.2: Website evidence (EDB) ───────────────────────────
        if school_data.get("website"):
            source_id = resolve_source("website", "EDB")
            chain.traces.append(self.trace(
                school_id, school_name, "website", school_data["website"], source_id
            ))

        # Academic signal evidence (CHSC)
        for key, val in sorted(school_data.items()):
            if key.startswith("academic_signal_") and val:
                label = key.replace("academic_signal_", "").replace("_", " ").title()
                source_id = resolve_source(key, "CHSC")
                chain.traces.append(self.trace(school_id, school_name, f"academic_{label}", val, source_id))

        # Facility evidence (CHSC)
        facilities = [k.replace("facility_", "").replace("_", " ").title()
                      for k, v in school_data.items()
                      if k.startswith("facility_") and v is True]
        if facilities:
            source_id = resolve_source("facilities", "CHSC")
            chain.traces.append(self.trace(school_id, school_name, "facilities",
                                           ", ".join(sorted(facilities)), source_id))

        # Fee evidence (CHSC — from fees_s1-s6)
        for i in range(1, 7):
            fee = school_data.get(f"fees_s{i}")
            if fee:
                source_id = resolve_source(f"fees_s{i}", "CHSC")
                chain.traces.append(self.trace(school_id, school_name, f"fees_s{i}",
                                               f"HKD {fee:,}", source_id))
                break  # Only show first available fee

        # Religion evidence (EDB or CHSC)
        religion = school_data.get("religion", "")
        if religion:
            source_id = resolve_source("religion", "EDB")
            chain.traces.append(self.trace(school_id, school_name, "religion", religion, source_id))

        return chain


# Singleton
tracer = EvidenceTracer()
tracer.register_source("EDB", "Education Bureau", "government", 9.0,
                       "https://www.edb.gov.hk")
tracer.register_source("CHSC", "Committee on Home-School Co-operation", "government", 8.0,
                       "https://www.chsc.hk")
tracer.register_source("KGP", "Kindergarten Profile", "government", 8.0,
                       "https://www.kgp.hk")
tracer.register_source("HKET", "HK Economic Times", "media", 5.0,
                       "https://www.hket.com")
tracer.register_source("data_gov_hk", "data.gov.hk", "government", 9.0,
                       "https://data.gov.hk")
