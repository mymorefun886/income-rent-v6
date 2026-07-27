# Education Entity — Comparison Mode Renderer
# Generates evidence-backed school comparison output
# Phase 10.1.7-D: Added locale support for localized output

from dataclasses import dataclass
from typing import Optional


@dataclass
class SchoolComparisonData:
    """Structured data for one school in comparison."""
    school_id: str
    name: str
    name_tc: str = ""  # Phase 10.1.7-D: Chinese name for localization
    district: str = ""
    school_type: str = ""
    student_gender: str = ""
    religion: str = ""
    academic_signals: dict = None
    facilities: list = None
    fees: dict = None

    def __post_init__(self):
        if self.academic_signals is None:
            self.academic_signals = {}
        if self.facilities is None:
            self.facilities = []
        if self.fees is None:
            self.fees = {}


def generate_comparison(
    schools: list[SchoolComparisonData],
    locale: str = "en",
    query: str = "",
    school_alias_map: dict | None = None,
) -> str:
    """Generate evidence-backed comparison output.

    Args:
        schools: List of SchoolComparisonData objects
        locale: 'zh-TW' or 'en' output language
        query: Original query (used for locale auto-detection if locale='en' default)
        school_alias_map: Optional {school_id: {locale: name}} mapping

    Returns:
        Localized comparison string

    Output format (en):
        === School Comparison ===

        #1 King's College
           District: Central & Western
           Type: DSS
           Gender: Boys
           Academic Signals:
             - Language: High
             - Science: High
           Facilities: Swimming Pool, Library

        #2 La Salle College
           ...

        === Key Differences ===
        + King's: Central district
        + La Salle: Kowloon City, stronger facilities
    """
    # Auto-detect locale from query if not explicitly set
    if not locale and query:
        from ..presentation.locale import detect_locale
        locale = detect_locale(query)

    # Use formatter for localized output (Phase 10.1.7-D)
    if locale == "zh-TW":
        from ..presentation.formatter import format_comparison
        school_dicts = [_school_to_dict(s) for s in schools]
        return format_comparison(school_dicts, locale=locale, query=query, school_alias_map=school_alias_map)

    # English output (default)
    if len(schools) < 2:
        return "（無法比較：需要至少兩所學校）"

    lines = [
        "=== School Comparison ===",
        "",
    ]

    for i, school in enumerate(schools, 1):
        lines.append(f"#{i} {school.name}")
        if school.district:
            lines.append(f"   District: {school.district}")
        if school.school_type:
            lines.append(f"   Type: {school.school_type}")
        if school.student_gender:
            gender_label = _gender_label(school.student_gender)
            lines.append(f"   Gender: {gender_label}")
        if school.religion:
            lines.append(f"   Religion: {school.religion}")

        # Academic signals
        if school.academic_signals:
            lines.append("   Academic Signals:")
            for signal, level in sorted(school.academic_signals.items()):
                label = signal.replace("_", " ").title()
                lines.append(f"     - {label}: {_signal_label(level)}")

        # Facilities
        if school.facilities:
            lines.append(f"   Facilities: {', '.join(school.facilities)}")

        # Fees
        if school.fees:
            for level, fee in school.fees.items():
                lines.append(f"   Fees ({level}): HKD {fee:,}")

        lines.append("")

    # Key differences
    diffs = _compute_differences(schools)
    if diffs:
        lines.append("=== Key Differences ===")
        for diff in diffs:
            lines.append(diff)
        lines.append("")

    lines.append("Source: CHSC (Committee on Home-School Co-operation)")
    lines.append("Data Year: 2025-2026")

    return "\n".join(lines)


def _gender_label(gender: str) -> str:
    """Convert internal gender value to display label."""
    mapping = {
        "boys_only": "Boys",
        "girls_only": "Girls",
        "co_ed": "Co-ed",
    }
    return mapping.get(gender, gender)


def _signal_label(level: str) -> str:
    """Convert signal level to display label."""
    mapping = {
        "high": "High",
        "medium": "Medium",
        "low": "Low",
    }
    return mapping.get(level, level.title())


def _school_to_dict(school: SchoolComparisonData) -> dict:
    """Convert SchoolComparisonData to dict for formatter compatibility."""
    result = {
        "school_id": school.school_id,
        "name": school.name,
        "name_tc": school.name_tc,
        "district": school.district,
        "school_type": school.school_type,
        "student_gender": school.student_gender,
        "religion": school.religion,
    }
    # Add academic signals
    for signal, level in school.academic_signals.items():
        result[f"academic_signal_{signal}"] = level
    # Add facilities
    for facility in school.facilities:
        key = facility.lower().replace(" ", "_")
        result[f"facility_{key}"] = True
    # Add fees
    for level, fee in school.fees.items():
        idx = level.replace("S", "").replace("s", "")
        result[f"fees_s{idx}"] = fee
    return result


def _compute_differences(schools: list[SchoolComparisonData]) -> list[str]:
    """Compute key differences between schools."""
    diffs = []
    s1, s2 = schools[0], schools[1]

    # District difference
    if s1.district != s2.district:
        diffs.append(f"+ {s1.name}: {s1.district} district")
        diffs.append(f"+ {s2.name}: {s2.district} district")

    # School type difference
    if s1.school_type != s2.school_type:
        diffs.append(f"+ {s1.name}: {s1.school_type}")
        diffs.append(f"+ {s2.name}: {s2.school_type}")

    # Gender difference
    if s1.student_gender != s2.student_gender:
        diffs.append(f"+ {s1.name}: {_gender_label(s1.student_gender)}")
        diffs.append(f"+ {s2.name}: {_gender_label(s2.student_gender)}")

    # Academic signal differences
    all_signals = set(s1.academic_signals.keys()) | set(s2.academic_signals.keys())
    for signal in sorted(all_signals):
        v1 = s1.academic_signals.get(signal, "n/a")
        v2 = s2.academic_signals.get(signal, "n/a")
        if v1 != v2:
            label = signal.replace("_", " ").title()
            diffs.append(f"+ {s1.name}: {label} = {_signal_label(v1)}")
            diffs.append(f"+ {s2.name}: {label} = {_signal_label(v2)}")

    # Facility differences
    fac1 = set(s1.facilities)
    fac2 = set(s2.facilities)
    only_s1 = fac1 - fac2
    only_s2 = fac2 - fac1
    if only_s1:
        diffs.append(f"+ {s1.name} has: {', '.join(sorted(only_s1))}")
    if only_s2:
        diffs.append(f"+ {s2.name} has: {', '.join(sorted(only_s2))}")

    return diffs


def school_data_to_comparison(school_data: dict) -> SchoolComparisonData:
    """Convert raw school data (from Qdrant/Postgres) to comparison format."""
    # Extract academic signals
    academic_signals = {}
    for key, val in school_data.items():
        if key.startswith("academic_signal_") and val:
            signal_name = key.replace("academic_signal_", "")
            academic_signals[signal_name] = val

    # Extract facilities
    facilities = []
    for key, val in school_data.items():
        if key.startswith("facility_") and val is True:
            facility_name = key.replace("facility_", "").replace("_", " ").title()
            facilities.append(facility_name)

    # Extract fees
    fees = {}
    for i in range(1, 7):
        fee = school_data.get(f"fees_s{i}")
        if fee:
            fees[f"S{i}"] = fee

    return SchoolComparisonData(
        school_id=school_data.get("school_id", ""),
        name=school_data.get("name", "Unknown"),
        name_tc=school_data.get("name_tc", ""),
        district=school_data.get("district", ""),
        school_type=school_data.get("school_type", ""),
        student_gender=school_data.get("student_gender", ""),
        religion=school_data.get("religion", ""),
        academic_signals=academic_signals,
        facilities=sorted(facilities),
        fees=fees,
    )
