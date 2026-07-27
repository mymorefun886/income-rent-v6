# Education Engine — Profile Builder
# Builds FamilyProfile and ChildProfile from recalled memory + user message

from .domain import (
    FAMILY_PROFILE_FIELDS,
    CHILD_PROFILE_FIELDS,
    DEFAULT_CRITERIA,
)
from .constraint_extractor import QueryConstraints


class FamilyProfile:
    """Parent/family constraints and preferences extracted from memory."""

    def __init__(self, recalled_profile: dict, recalled_preferences: list):
        # Base defaults from recalled_profile (PG stores {key: {value, meta}} wrappers)
        raw = _unwrap_profile(recalled_profile)
        self.preferred_districts = _parse_list(raw.get("preferred_districts", []))
        self.max_annual_fee = _parse_int(raw.get("max_annual_fee", 0))
        self.preferred_language = str(raw.get("preferred_language", ""))
        self.religious_preference = str(raw.get("religious_preference", "none"))
        self.commute_tolerance_minutes = _parse_int(raw.get("commute_tolerance_minutes", 45))
        self.has_siblings_in_school = _parse_bool(raw.get("has_siblings_in_school", False))
        self.sibling_school_ids = _parse_list(raw.get("sibling_school_ids", []))

        # Override from recalled preferences (key-value or direct format)
        for pref in recalled_preferences:
            if pref.get("domain") != "education":
                continue
            # Memory service key-value format: {domain, key, value, weight}
            k = pref.get("key", "")
            v = pref.get("value", "")
            if k and k in FAMILY_PROFILE_FIELDS:
                setattr(self, k, _coerce_type(k, v))
            # Direct format (future): field names are keys in the dict itself
            for key in FAMILY_PROFILE_FIELDS:
                if key in pref and key != "key":
                    setattr(self, key, pref[key])

    def to_dict(self) -> dict:
        return {f: getattr(self, f) for f in FAMILY_PROFILE_FIELDS}


class ChildProfile:
    """Individual child profile built from memory and conversation context."""

    def __init__(self, recalled_profile: dict, message_hints: dict | None = None,
                 query_constraints: QueryConstraints | None = None):
        hints = message_hints or {}
        self.age = recalled_profile.get("child_age", hints.get("age", 0))
        self.grade_level = recalled_profile.get("child_grade", hints.get("grade_level", ""))
        self.academic_level = recalled_profile.get("child_academic_level", hints.get("academic_level", "average"))
        self.language_strength = recalled_profile.get("child_language", hints.get("language_strength", "chinese"))
        self.special_needs = recalled_profile.get("child_special_needs", hints.get("special_needs", []))
        self.personality_type = recalled_profile.get("child_personality", hints.get("personality_type", ""))
        self.target_band = recalled_profile.get("target_band", hints.get("target_band", ""))

        # Interests: merge memory + query constraints
        memory_interests = recalled_profile.get("child_interests", hints.get("interests", []))
        constraint_interests = query_constraints.interests if query_constraints else []
        self.extracurricular_interests = list(set(memory_interests + constraint_interests))

        # Gender: from query constraints (阿仔/阿女) or memory
        query_gender = query_constraints.gender if query_constraints else None
        if query_gender:
            self.gender = "male" if query_gender == "boys_only" else "female" if query_gender == "girls_only" else "co_ed"
        else:
            self.gender = recalled_profile.get("child_gender", hints.get("gender", ""))

    def to_dict(self) -> dict:
        return {f: getattr(self, f) for f in CHILD_PROFILE_FIELDS}


def build_profiles(ctx, query_constraints: QueryConstraints | None = None) -> tuple[FamilyProfile, ChildProfile, list[str]]:
    """Build profiles from TaskContext recalled memory. Returns (family, child, criteria_weights)."""

    family = FamilyProfile(ctx.recalled_profile, ctx.recalled_preferences)

    message_hints = _extract_message_hints(ctx.raw_message)
    child = ChildProfile(ctx.recalled_profile, message_hints, query_constraints)

    criteria = list(DEFAULT_CRITERIA)
    if family.religious_preference != "none":
        criteria.insert(2, "religious_affiliation")
    if family.preferred_language:
        criteria.insert(1, "language_of_instruction")

    return family, child, criteria


def _extract_message_hints(raw_message: str) -> dict:
    """Extract simple signal words from user message as profile hints."""
    hints = {}
    msg = raw_message.lower()

    if any(w in msg for w in ["band 1", "band one", "top school", "elite"]):
        hints["target_band"] = "Band 1"
    elif any(w in msg for w in ["band 2", "band two", "mid-tier"]):
        hints["target_band"] = "Band 2"
    elif any(w in msg for w in ["band 3", "band three"]):
        hints["target_band"] = "Band 3"

    if any(w in msg for w in ["english", "英文"]):
        hints["language_strength"] = "english"
    elif any(w in msg for w in ["chinese", "中文", "cantonese"]):
        hints["language_strength"] = "chinese"

    interests_keywords = {
        "sport": "sports", "music": "music", "art": "arts",
        "science": "stem", "stem": "stem", "coding": "stem",
    }
    found_interests = [
        v for k, v in interests_keywords.items() if k in msg
    ]
    if found_interests:
        hints["interests"] = list(set(found_interests))

    return hints


def _unwrap_profile(profile: dict) -> dict:
    """Unwrap PG profile storage format {key: {value, meta}} → {key: raw_value}."""
    out = {}
    for k, v in profile.items():
        if isinstance(v, dict) and "value" in v:
            out[k] = v["value"]
        else:
            out[k] = v
    return out


def _parse_list(value) -> list:
    """Parse a value that may be a list or comma-separated string."""
    if isinstance(value, list):
        return value
    s = str(value).strip()
    if not s:
        return []
    return [x.strip() for x in s.split(",")]


def _parse_int(value) -> int:
    """Parse int, handling string values from PG storage."""
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0


def _parse_bool(value) -> bool:
    """Parse bool, handling string values from PG storage."""
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("true", "1", "yes")


def _coerce_type(key: str, value: str):
    """Coerce a string value to the expected type for a profile field."""
    list_fields = {"preferred_districts", "sibling_school_ids"}
    int_fields = {"max_annual_fee", "commute_tolerance_minutes"}
    bool_fields = {"has_siblings_in_school"}

    if key in list_fields:
        return _parse_list(value)
    if key in int_fields:
        return _parse_int(value)
    if key in bool_fields:
        return _parse_bool(value)
    return value
