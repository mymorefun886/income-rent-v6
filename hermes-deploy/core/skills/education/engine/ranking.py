# Education Engine — Multi-Factor Ranking
# Scores schools using: constraint (0.5) + academic_signal (0.25) + preference (0.15) + evidence (0.10)
# Uses v2 schema fields (academic_signal_*, facility_*).
#
# Phase 10.2: Geo distance scoring folded into preference_match (NOT new weight — avoids v2.0 bump)

import math

from .domain import DEFAULT_CRITERIA
from skills.education.data.ranking_config import RankingConfig, load_config


# ── Geo Distance Scoring ────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in km using Haversine formula.

    Args:
        lat1, lon1: First point coordinates (decimal degrees).
        lat2, lon2: Second point coordinates (decimal degrees).

    Returns:
        Distance in kilometers.
    """
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    return R * c


def _score_distance(school: dict, family_lat: float, family_lng: float,
                    tolerance_km: float = 10.0) -> float:
    """Score school based on distance from family location.

    Folded into preference_match — does NOT add new ranking weight (avoids v2.0 bump).

    Args:
        school: School data dict (must have latitude/longitude from EDB).
        family_lat: Family latitude.
        family_lng: Family longitude.
        tolerance_km: Max acceptable distance (default 10km).

    Returns:
        0.0-1.0 score (1.0 = within 1km, 0.0 = beyond tolerance).
    """
    school_lat = school.get("latitude")
    school_lng = school.get("longitude")

    if not school_lat or not school_lng or not family_lat or not family_lng:
        return 0.5  # Neutral if no geo data

    dist_km = _haversine_km(family_lat, family_lng, school_lat, school_lng)

    if dist_km <= 1.0:
        return 1.0
    elif dist_km >= tolerance_km:
        return 0.0
    else:
        return 1.0 - (dist_km / tolerance_km)


def rank_schools(
    eligible_schools: list[dict],
    family,
    child,
    evidence_map: dict[str, list],
    criteria: list[str] | None = None,
    config: RankingConfig | None = None,
    query_constraints=None,
    geo_context: dict | None = None,
) -> list[dict]:
    """
    Score and rank eligible schools. Returns list of (school, score, breakdown).
    Uses configurable weights from RankingConfig.

    Args:
        eligible_schools: Schools that passed hard constraint filter.
        family: FamilyProfile with preferences.
        child: ChildProfile with child attributes.
        evidence_map: {school_name: [evidence_items]} mapping.
        criteria: Ranking criteria list.
        config: RankingConfig with weights (default: load from ranking_config.py).
        query_constraints: QueryConstraints from constraint_extractor.
        geo_context: Optional {family_lat, family_lng, tolerance_km} for distance scoring.
    """
    if config is None:
        config = load_config("balanced")
    criteria = criteria or DEFAULT_CRITERIA
    scored = []

    for school in eligible_schools:
        name = school.get("name", "unknown")
        constraint_score = _score_constraints(school, family)
        academic_score = _score_academic_signals(school, query_constraints)
        preference_score = _score_preference_match(school, child, query_constraints,
                                                   geo_context=geo_context)
        evidence_score = _score_evidence(evidence_map.get(name, []))

        # Weighted total using config weights
        total = (
            constraint_score * config.constraint_weight
            + academic_score * config.academic_signal_weight
            + preference_score * config.preference_match_weight
            + evidence_score * config.evidence_weight
        )

        scored.append({
            "school": school,
            "total_score": round(total, 2),
            "breakdown": {
                "constraint": round(constraint_score, 2),
                "academic_signal": round(academic_score, 2),
                "preference_match": round(preference_score, 2),
                "evidence": round(evidence_score, 2),
            },
            "config_version": config.version,
        })

    scored.sort(key=lambda x: x["total_score"], reverse=True)
    return scored


def _score_constraints(school: dict, family) -> float:
    """Score how well a school satisfies family constraints (0.0–1.0)."""
    score = 1.0
    checks = 0

    if family.preferred_districts and school.get("district"):
        checks += 1
        if school["district"] not in family.preferred_districts:
            score -= 0.3

    if family.max_annual_fee > 0:
        for i in range(1, 7):
            fee = school.get(f"fees_s{i}")
            if fee:
                checks += 1
                ratio = fee / family.max_annual_fee
                if ratio > 1:
                    score -= min(0.5, (ratio - 1) * 2)
                break

    if family.preferred_language and school.get("language_policy"):
        checks += 1
        if family.preferred_language.lower() not in school["language_policy"].lower():
            score -= 0.1

    # Slight bonus for central accessible districts
    central_districts = {"Kowloon City", "Yau Tsim Mong", "Central & Western", "Wan Chai"}
    if school.get("district") in central_districts:
        score += 0.05

    return max(0.0, min(1.0, score))


def _score_academic_signals(school: dict, query_constraints) -> float:
    """Score based on academic signal match with query interests (v2 schema).

    Reads academic_signal_* fields directly from Qdrant payload.
    """
    if not query_constraints or not query_constraints.interests:
        return 0.3  # neutral default when no interests specified

    score = 0.0
    checks = 0

    for interest in query_constraints.interests:
        signal_key = _interest_to_signal_key(interest)
        if signal_key:
            signal_val = school.get(signal_key, "")
            if signal_val:
                checks += 1
                if signal_val == "high":
                    score += 0.4
                elif signal_val == "medium":
                    score += 0.2
                elif signal_val == "low":
                    score += 0.05

    return min(1.0, score) if checks > 0 else 0.1


def _score_preference_match(school: dict, child, query_constraints,
                            geo_context: dict | None = None) -> float:
    """Score based on child profile + facility match + geo distance (v2 schema).

    Phase 10.2: Geo distance folded into preference_match (NOT new weight).
    This avoids v2.0 bump per CHANGE_POLICY.

    Args:
        school: School data dict.
        child: ChildProfile instance.
        query_constraints: QueryConstraints from constraint_extractor.
        geo_context: Optional {family_lat, family_lng, tolerance_km} from memory/query.
    """
    score = 0.0
    checks = 0

    # Facility matching (v2 payload has facility_* booleans)
    if child.extracurricular_interests:
        for interest in child.extracurricular_interests:
            facility_key = f"facility_{interest}"
            if school.get(facility_key) is True:
                checks += 1
                score += 0.15

    # Gender match
    child_gender = child.to_dict().get("gender", "")
    school_gender = school.get("student_gender", "")
    if child_gender and school_gender:
        checks += 1
        if school_gender == "co_ed" or \
           (school_gender == "boys_only" and child_gender == "male") or \
           (school_gender == "girls_only" and child_gender == "female"):
            score += 0.2

    # ── Phase 10.2: Geo distance scoring (folded into preference_match) ──
    if geo_context and geo_context.get("family_lat") and geo_context.get("family_lng"):
        checks += 1
        dist_score = _score_distance(
            school,
            geo_context["family_lat"],
            geo_context["family_lng"],
            geo_context.get("tolerance_km", 10.0)
        )
        score += dist_score * 0.3  # Max 0.3 contribution from distance

    return min(1.0, score) if checks > 0 else 0.3


def _score_evidence(evidence_items: list) -> float:
    """Score evidence quality (0.0–1.0). More diverse evidence = higher score."""
    if not evidence_items:
        return 0.0
    # Count distinct evidence sources
    sources = set()
    for e in evidence_items:
        if isinstance(e, dict):
            sources.add(e.get("source", "unknown"))
    return min(1.0, len(sources) * 0.25 + len(evidence_items) * 0.1)


def _interest_to_signal_key(interest: str) -> str | None:
    """Map interest keyword to academic_signal payload field name."""
    mapping = {
        "stem": "academic_signal_science_availability",
        "science": "academic_signal_science_availability",
        "sports": "academic_signal_sports",
        "music": "academic_signal_music",
        "arts": "academic_signal_arts",
        "languages": "academic_signal_language_strength",
    }
    return mapping.get(interest.lower())
