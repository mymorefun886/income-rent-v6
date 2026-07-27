# Education Data Layer — Domain Models
# Canonical school entity and related data classes

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class School:
    """Canonical school entity."""
    school_id: str
    canonical_name_en: str
    canonical_name_zh: str
    school_type: str                          # government, aided, dss, private, international
    school_level: str                         # kindergarten, primary, secondary
    gender: str = "co_ed"
    year_established: Optional[int] = None
    status: str = "active"
    aliases: list[str] = field(default_factory=list)


@dataclass
class SchoolDetail:
    """Structured facts about a school."""
    school_id: str
    district: str = ""
    sub_district: str = ""
    address_en: str = ""
    address_zh: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    band: str = ""
    language_medium: str = ""
    religious_affiliation: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    has_library: bool = False
    has_laboratory: bool = False
    has_sports_ground: bool = False
    has_swimming_pool: bool = False
    has_music_room: bool = False
    has_computer_room: bool = False
    data_source: str = ""
    data_updated_at: Optional[str] = None


@dataclass
class SchoolFee:
    """Fee structure for a school."""
    school_id: str
    academic_year: str
    level: str
    annual_fee: float = 0.0
    monthly_fee: float = 0.0
    has_fee_remission: bool = False
    fee_source: str = ""


@dataclass
class SchoolRanking:
    """External ranking data point."""
    school_id: str
    ranking_source: str
    ranking_year: Optional[int] = None
    ranking_category: str = "overall"
    rank_position: Optional[int] = None
    rank_score: Optional[float] = None
    rank_detail: dict = field(default_factory=dict)


@dataclass
class SchoolAdmission:
    """Admission criteria and quotas."""
    school_id: str
    academic_year: str
    level: str
    total_places: int = 0
    open_places: int = 0
    admission_criteria: dict = field(default_factory=dict)
    interview_required: Optional[bool] = None
    priority_siblings: bool = False
    priority_alumni: bool = False
    priority_religion: bool = False
    data_source: str = ""


@dataclass
class EvidenceItem:
    """Single evidence fact with source provenance."""
    school_id: str
    source_id: str
    factor: str
    factor_value: str
    evidence_text: str = ""
    evidence_url: str = ""
    retrieved_at: Optional[str] = None


@dataclass
class RankingConfig:
    """Configurable ranking weights."""
    domain: str = "education"
    version: str = "v1"
    name: str = "Default"
    description: str = ""
    weights: dict = field(default_factory=lambda: {"constraint": 0.5, "fit": 0.3, "evidence": 0.2})
    is_active: bool = True


@dataclass
class DecisionFeedback:
    """User feedback on a recommendation (for weight optimization)."""
    user_id: str
    school_id: str
    feedback_type: str                       # accepted, rejected, saved, ignored
    recommendation_id: str = ""
    feedback_reason: str = ""
    context: dict = field(default_factory=dict)


# Engine-compatible dict conversion (bridges PG model → engine's dict format)
def school_to_engine_dict(school: School, detail: SchoolDetail | None = None,
                           fee: SchoolFee | None = None, ranking: SchoolRanking | None = None) -> dict:
    """Convert canonical school models to the dict format the education engine expects."""
    d = {
        "name": school.canonical_name_en,
        "name_zh": school.canonical_name_zh,
        "school_id": school.school_id,
        "type": school.school_type,
        "levels": [school.school_level],
        "gender": school.gender,
    }
    if detail:
        d.update({
            "district": detail.district,
            "band": detail.band,
            "language": detail.language_medium,
            "religion": detail.religious_affiliation,
            "latitude": detail.latitude,
            "longitude": detail.longitude,
            "website": detail.website,
        })
    if fee:
        d["annual_fee"] = fee.annual_fee
    if ranking:
        d["rank_position"] = ranking.rank_position
        d["rank_score"] = ranking.rank_score
        d["ranking_category"] = ranking.ranking_category
    return d
