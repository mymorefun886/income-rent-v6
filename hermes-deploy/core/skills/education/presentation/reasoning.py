# Phase 10.1.7-E: Reasoning Generator
# Generates parent-friendly reasoning from decision trace.
# Avoids hardcoding — reasoning always reflects actual trace data.

from typing import Optional


def generate_reasoning_from_trace(
    constraint_match: dict,
    academic_match: dict,
    school: dict,
    locale: str = "zh-TW",
) -> str:
    """Generate parent-friendly reasoning from trace data.

    Args:
        constraint_match: {district: bool, gender: bool, school_type: bool, ...}
        academic_match: {science: 0.4, music: 0.2, ...}
        school: School data dict
        locale: 'zh-TW' or 'en'

    Returns:
        Localized reasoning string

    Example:
        constraint_match = {"district": True, "gender": True}
        academic_match = {"science": 0.4}
        school = {"district": "Kowloon City", "student_gender": "boys_only"}

        → zh-TW: "✓ 符合地區：九龍城；✓ 符合性別：男校；✓ 科學發展能力：高"
        → en: "✓ District match: Kowloon City; ✓ Gender match: Boys; ✓ Science strength: High"
    """
    reasons = []

    if locale == "zh-TW":
        return _generate_reasoning_zh(constraint_match, academic_match, school)
    else:
        return _generate_reasoning_en(constraint_match, academic_match, school)


def _generate_reasoning_zh(
    constraint_match: dict,
    academic_match: dict,
    school: dict,
) -> str:
    """Generate Chinese reasoning from trace."""
    reasons = []

    # Constraint matches (✓ for parent confidence)
    if constraint_match.get("district"):
        district = school.get("district", "")
        district_labels = {
            "Central & Western": "中西區", "Wan Chai": "灣仔", "Eastern": "東區",
            "Southern": "南區", "Yau Tsim Mong": "油尖旺", "Sham Shui Po": "深水埗",
            "Kowloon City": "九龍城", "Wong Tai Sin": "黃大仙", "Kwun Tong": "觀塘",
            "Kwai Tsing": "葵青", "Tsuen Wan": "荃灣", "Tuen Mun": "屯門",
            "Yuen Long": "元朗", "North": "北區", "Tai Po": "大埔",
            "Sai Kung": "西貢", "Sha Tin": "沙田", "Islands": "離島",
        }
        district_tc = district_labels.get(district, district)
        reasons.append(f"✓ 符合地區：{district_tc}")

    if constraint_match.get("gender"):
        gender = school.get("student_gender", "")
        gender_labels = {"boys_only": "男校", "girls_only": "女校", "co_ed": "男女校"}
        gender_tc = gender_labels.get(gender, gender)
        reasons.append(f"✓ 符合性別：{gender_tc}")

    if constraint_match.get("school_type"):
        school_type = school.get("school_type", "")
        reasons.append(f"✓ 符合學校類型：{school_type}")

    # Academic matches (interest alignment)
    signal_labels_zh = {
        "science": "科學發展", "language_strength": "語文能力",
        "subject_breadth": "科目多元性", "sports": "體育",
        "music": "音樂", "arts": "藝術",
    }
    for signal, score in academic_match.items():
        if score > 0.2:  # Only mention meaningful matches
            label = signal_labels_zh.get(signal, signal)
            if score >= 0.3:
                reasons.append(f"✓ {label}能力：高")
            elif score >= 0.15:
                reasons.append(f"✓ {label}能力：中")

    # Fallback
    if not reasons:
        reasons.append("✓ 符合基本條件")

    return "；".join(reasons)


def _generate_reasoning_en(
    constraint_match: dict,
    academic_match: dict,
    school: dict,
) -> str:
    """Generate English reasoning from trace."""
    reasons = []

    if constraint_match.get("district"):
        district = school.get("district", "")
        reasons.append(f"✓ District match: {district}")

    if constraint_match.get("gender"):
        gender = school.get("student_gender", "")
        gender_labels = {"boys_only": "Boys", "girls_only": "Girls", "co_ed": "Co-ed"}
        gender_en = gender_labels.get(gender, gender)
        reasons.append(f"✓ Gender match: {gender_en}")

    if constraint_match.get("school_type"):
        school_type = school.get("school_type", "")
        reasons.append(f"✓ School type: {school_type}")

    signal_labels_en = {
        "science": "Science", "language_strength": "Language",
        "subject_breadth": "Subject breadth", "sports": "Sports",
        "music": "Music", "arts": "Arts",
    }
    for signal, score in academic_match.items():
        if score > 0.2:
            label = signal_labels_en.get(signal, signal)
            if score >= 0.3:
                reasons.append(f"✓ {label} strength: High")
            elif score >= 0.15:
                reasons.append(f"✓ {label} strength: Medium")

    if not reasons:
        reasons.append("✓ Meets basic criteria")

    return "; ".join(reasons)


def build_constraint_match(
    school: dict,
    query_constraints,
) -> dict:
    """Build constraint_match dict from school data + query constraints.

    This bridges Phase 10.1.6 constraint extraction with Phase 10.1.7-E reasoning.
    """
    match = {}

    if not query_constraints:
        return match

    # District match
    if query_constraints.districts:
        match["district"] = school.get("district") in query_constraints.districts

    # Gender match
    if query_constraints.gender:
        school_gender = school.get("student_gender", "")
        match["gender"] = (
            school_gender == query_constraints.gender or
            school_gender == "co_ed"
        )

    # School type match
    if query_constraints.school_types:
        match["school_type"] = school.get("school_type") in query_constraints.school_types

    return match


def build_academic_match(
    school: dict,
    query_constraints,
) -> dict:
    """Build academic_match dict from school data + query constraints.

    Maps query interests to academic_signal scores.
    """
    match = {}

    if not query_constraints or not query_constraints.interests:
        return match

    signal_key_map = {
        "stem": "science_availability",
        "science": "science_availability",
        "sports": "sports",
        "music": "music",
        "arts": "arts",
        "languages": "language_strength",
    }

    for interest in query_constraints.interests:
        signal_key = signal_key_map.get(interest.lower())
        if signal_key:
            full_key = f"academic_signal_{signal_key}"
            signal_val = school.get(full_key, "")
            if signal_val == "high":
                match[signal_key] = 0.4
            elif signal_val == "medium":
                match[signal_key] = 0.2
            elif signal_val == "low":
                match[signal_key] = 0.05

    return match
