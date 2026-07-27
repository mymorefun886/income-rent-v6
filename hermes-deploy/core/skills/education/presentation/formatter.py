# Phase 10.1.7-D: Response Formatter
# Dispatches to locale-specific formatters based on detected locale.
# Enhanced: Decision-oriented output for parent decision support.

from __future__ import annotations

from typing import Optional

from .locale import detect_locale, resolve_locale, get_school_name


# ── Comparison Formatter ────────────────────────────────────

def format_comparison(
    schools: list[dict],
    locale: str | None = None,
    query: str = "",
    school_alias_map: dict | None = None,
) -> str:
    """Format school comparison for output.

    Args:
        schools: List of school data dicts
        locale: 'zh-TW' or 'en'. If None, auto-detect from query.
        query: Original query (used for locale detection if locale not provided)
        school_alias_map: Optional {school_id: {locale: name}} mapping

    Returns:
        Formatted comparison string
    """
    if locale is None:
        locale = detect_locale(query)

    if locale == "zh-TW":
        from .zh_tw import (
            gender_label_zh as gender_label,
            school_type_label_zh as school_type_label,
            district_label_zh as district_label,
            signal_label_zh as signal_label,
            signal_level_zh as signal_level,
            SECTION_HEADERS_ZH as headers,
        )
    else:
        from .en import (
            gender_label_en as gender_label,
            school_type_label_en as school_type_label,
            district_label_en as district_label,
            signal_label_en as signal_label,
            signal_level_en as signal_level,
            SECTION_HEADERS_EN as headers,
        )

    lines = [headers["comparison_title"]]

    for i, school in enumerate(schools, 1):
        name = get_school_name(school, locale, school_alias_map)
        lines.append(f"\n#{i} {name}")

        # Location + Type + Gender (decision-critical)
        lines.append(f"  {headers['district']}: {district_label(school.get('district', ''))}")
        lines.append(f"  {headers['type']}: {school_type_label(school.get('school_type', ''))}")
        lines.append(f"  {headers['gender']}: {gender_label(school.get('student_gender', ''))}")

        if school.get("religion"):
            lines.append(f"  {headers['religion']}: {school['religion']}")

        # Academic signals (parent decision factor)
        signals = []
        for key, val in school.items():
            if key.startswith("academic_signal_") and val:
                label = signal_label(key.replace("academic_signal_", ""))
                level = signal_level(val)
                signals.append(f"{label}: {level}")
        if signals:
            lines.append(f"  {headers['academic_signals']}:")
            for s in signals:
                lines.append(f"    - {s}")

        # Facilities (parent decision factor)
        facilities = []
        for key, val in school.items():
            if key.startswith("facility_") and val is True:
                facilities.append(key.replace("facility_", "").replace("_", " ").title())
        if facilities:
            lines.append(f"  {headers['facilities']}: {', '.join(sorted(facilities))}")

        # Fees (critical for DSS/Private schools)
        # Government/Aided schools typically have no tuition fees
        school_type = school.get("school_type", "")
        fee_shown = False
        for i_fee in range(1, 7):
            fee = school.get(f"fees_s{i_fee}")
            if fee:
                lines.append(f"  {headers['fees'].format(level=i_fee)}: HKD {fee:,}")
                fee_shown = True
        if not fee_shown:
            # No fee data available — show school-type-based hint
            if school_type in ("Government", "Aided"):
                lines.append(f"  {headers['fees'].format(level=1)}: 免費（官立/資助學校免學費）")
            elif school_type == "DSS":
                lines.append(f"  {headers['fees'].format(level=1)}: 請參考學校官網（直資學校學費各異）")
            else:
                lines.append(f"  {headers['fees'].format(level=1)}: 請參考學校官網")

    # Source + Year
    lines.append(f"\n{headers['source']}")
    lines.append(headers["data_year"])
    return "\n".join(lines)


# ── Recommendation Formatter ────────────────────────────────

def format_recommendation(
    results: list[dict],
    locale: str | None = None,
    query: str = "",
    school_alias_map: dict | None = None,
    query_constraints=None,
) -> str:
    """Format recommendation results for output.

    Args:
        results: List of result dicts with 'school', 'total_score', 'component_scores', 'evidence'
        locale: 'zh-TW' or 'en'. If None, auto-detect from query.
        query: Original query (used for locale detection if locale not provided)
        school_alias_map: Optional {school_id: {locale: name}} mapping
        query_constraints: Extracted query constraints (for reasoning generation)

    Returns:
        Formatted recommendation string
    """
    if locale is None:
        locale = detect_locale(query)

    if locale == "zh-TW":
        from .zh_tw import (
            gender_label_zh as gender_label,
            school_type_label_zh as school_type_label,
            district_label_zh as district_label,
            SECTION_HEADERS_ZH as headers,
        )
    else:
        from .en import (
            gender_label_en as gender_label,
            school_type_label_en as school_type_label,
            district_label_en as district_label,
            SECTION_HEADERS_EN as headers,
        )

    lines = [headers["recommendation_title"]]

    for i, result in enumerate(results, 1):
        school = result.get("school", {})
        name = get_school_name(school, locale, school_alias_map)
        score = result.get("total_score", 0)
        components = result.get("component_scores", {})
        evidence = result.get("evidence", [])

        lines.append(f"\n#{i} {name} — {headers['overall_score']}: {score:.2f}")
        lines.append(f"  {headers['district']}: {district_label(school.get('district', ''))}")
        lines.append(f"  {headers['type']}: {school_type_label(school.get('school_type', ''))}")
        lines.append(f"  {headers['gender']}: {gender_label(school.get('student_gender', ''))}")

        if components:
            constraint = components.get("constraint", 0)
            academic = components.get("academic", 0)
            preference = components.get("preference", 0)
            evidence_q = components.get("evidence_quality", 0)
            lines.append(f"  {headers['constraint']}: {constraint:.2f}")
            lines.append(f"  {headers['academic']}: {academic:.2f}")
            lines.append(f"  {headers['preference']}: {preference:.2f}")
            lines.append(f"  {headers['evidence']}: {evidence_q:.2f}")

        # Phase 10.1.7-E: Generate reasoning from trace (not hardcoded)
        from .reasoning import generate_reasoning_from_trace, build_constraint_match, build_academic_match
        constraint_match = build_constraint_match(school, query_constraints)
        academic_match = build_academic_match(school, query_constraints)
        reasoning = generate_reasoning_from_trace(constraint_match, academic_match, school, locale)
        lines.append(f"  {headers['reasoning']}: {reasoning}")

        if evidence:
            lines.append(f"  {headers['evidence_trace']}:")
            for e in evidence[:5]:
                lines.append(f"    - {e.get('claim', '')}: {e.get('value', '')}")

    # Next steps (actionable, not generic)
    lines.append(f"\n{headers['suggested_next_steps']}:")
    for step in headers["next_steps_list"]:
        lines.append(f"  - {step}")

    return "\n".join(lines)
