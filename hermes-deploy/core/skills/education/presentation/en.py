# Phase 10.1.7-D: English Response Formatter
# Default formatter for English queries — decision-oriented.


# ── Label mappings ──────────────────────────────────────────

GENDER_LABELS_EN = {
    "boys_only": "Boys",
    "girls_only": "Girls",
    "co_ed": "Co-ed",
}

SCHOOL_TYPE_LABELS_EN = {
    "Government": "Government",
    "Aided": "Aided",
    "DSS": "DSS",
    "Private": "Private",
    "International": "International",
}

SIGNAL_LABELS_EN = {
    "language_strength": "Language Strength",
    "science_availability": "Science Availability",
    "subject_breadth": "Subject Breadth",
    "sports": "Sports",
    "music": "Music",
    "arts": "Arts",
}

SIGNAL_LEVEL_EN = {
    "high": "High",
    "medium": "Medium",
    "low": "Low",
}


def gender_label_en(gender: str) -> str:
    return GENDER_LABELS_EN.get(gender, gender.replace("_", " ").title())


def school_type_label_en(school_type: str) -> str:
    return SCHOOL_TYPE_LABELS_EN.get(school_type, school_type)


def district_label_en(district: str) -> str:
    return district  # English districts are already in English


def signal_label_en(signal: str) -> str:
    return SIGNAL_LABELS_EN.get(signal, signal.replace("_", " ").title())


def signal_level_en(level: str) -> str:
    return SIGNAL_LEVEL_EN.get(level, level.capitalize())


# ── Decision-oriented section headers ──────────────────────

SECTION_HEADERS_EN = {
    "comparison_title": "=== School Comparison ===",
    "recommendation_title": "=== Hermes Education Recommendation ===",
    "key_differences": "=== Key Differences ===",
    "district": "📍 District",
    "type": "🏫 Type",
    "gender": "👦 Gender",
    "religion": "⛪ Religion",
    "academic_signals": "📚 Academic Strengths",
    "facilities": "🏢 Facilities",
    "fees": "💰 Fees (S{level})",
    "overall_score": "Overall Score",
    "constraint": "Constraint",
    "academic": "Academic",
    "preference": "Preference",
    "evidence": "Evidence",
    "evidence_trace": "📋 Evidence Trace",
    "reasoning": "💡 Why This School",
    "source": "📊 Source: CHSC (Committee on Home-School Co-operation)",
    "data_year": "📅 Data Year: 2025-2026",
    "suggested_next_steps": "📝 Suggested Next Steps",
    "next_steps_list": [
        "Visit shortlisted schools during open days",
        "Prepare application documents (transcripts, certificates)",
        "Talk to current parents or alumni",
        "Consider your child's interests and school strengths",
    ],
}
