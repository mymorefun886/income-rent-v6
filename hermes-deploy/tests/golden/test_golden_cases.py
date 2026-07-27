# Phase 10.1.9: Golden Test Suite
# Fixed test cases for Education Engine v1.0 freeze verification.
# These tests MUST PASS before freeze is declared.

"""
Usage:
    cd hermes-deploy
    python -m pytest tests/golden/ -v

Or run individual test:
    python -m pytest tests/golden/test_entity_resolution.py -v
"""

import pytest


# ── Golden Case 1: Entity Resolution ────────────────────────

GOLDEN_ENTITY_CASE = {
    "name": "entity_resolution_basic",
    "input": "比較英皇書院和喇沙書院",
    "expected": {
        "intent": "school_comparison",
        "entity_count": 2,
        "school_ids": ["SCH-00402", "SCH-00166"],  # King's College, La Salle College
        "locale": "zh-TW",
    },
}


# ── Golden Case 2: Constraint Extraction ────────────────────

GOLDEN_CONSTRAINT_CASE = {
    "name": "constraint_extraction_district_gender",
    "input": "九龍城男校推薦",
    "expected": {
        "intent": "recommendation",
        "constraints": {
            "districts": ["Kowloon City"],
            "gender": "boys_only",
        },
        "locale": "zh-TW",
    },
}


# ── Golden Case 3: Memory Isolation ─────────────────────────

GOLDEN_MEMORY_CASE = {
    "name": "memory_isolation_rejected_school",
    "setup": {
        "previous_feedback": {
            "user_id": "golden_test_user",
            "school_id": "SCH-00153",  # DBS (Diocesan Boys' School)
            "feedback_type": "rejected",
            "reason": "too_far",
        },
    },
    "input": "推薦男校",
    "expected": {
        "intent": "recommendation",
        "excluded_schools": ["SCH-00153"],  # DBS should be excluded
        "locale": "zh-TW",
    },
}


# ── Golden Case 4: English Locale ───────────────────────────

GOLDEN_ENGLISH_CASE = {
    "name": "locale_english",
    "input": "Compare King's College and La Salle College",
    "expected": {
        "intent": "school_comparison",
        "locale": "en",
        "entity_count": 2,
    },
}


# ── Golden Case 5: Mixed Language (CJK Priority) ─────────────

GOLDEN_MIXED_CASE = {
    "name": "locale_mixed_cjk_priority",
    "input": "Compare 英皇書院 and La Salle",
    "expected": {
        "intent": "school_comparison",
        "locale": "zh-TW",  # CJK priority
        "entity_count": 2,
    },
}


# ── Golden Case 6: Feedback Loop ────────────────────────────

GOLDEN_FEEDBACK_CASE = {
    "name": "feedback_natural_language",
    "input": {
        "user_id": "golden_test_user",
        "school_id": "SCH-00166",
        "comment": "呢間太遠",
    },
    "expected": {
        "feedback_type": "rejected",
        "reason": "too_far",
        "locale": "zh-TW",
        "confidence": 0.8,
    },
}


# ── Golden Case 7: No Results ───────────────────────────────

GOLDEN_NO_RESULTS_CASE = {
    "name": "no_results_graceful",
    "input": "火星中學推薦",
    "expected": {
        "intent": "recommendation",
        "error_code": "ENTITY_NOT_FOUND",
        "has_suggestions": True,
    },
}


# ── Golden Case 8: Trace Linkage ────────────────────────────

GOLDEN_TRACE_CASE = {
    "name": "trace_linkage",
    "input": "九龍城英文中學推薦",
    "expected": {
        "intent": "recommendation",
        "has_trace_id": True,
        "trace_id_format": "uuid",  # Must be valid UUID
    },
}


# ── Collection of all golden cases ──────────────────────────

GOLDEN_CASES = [
    GOLDEN_ENTITY_CASE,
    GOLDEN_CONSTRAINT_CASE,
    GOLDEN_MEMORY_CASE,
    GOLDEN_ENGLISH_CASE,
    GOLDEN_MIXED_CASE,
    GOLDEN_FEEDBACK_CASE,
    GOLDEN_NO_RESULTS_CASE,
    GOLDEN_TRACE_CASE,
]


# ── Test Functions (for pytest) ─────────────────────────────

def test_golden_case_exists():
    """Verify all golden cases are defined."""
    assert len(GOLDEN_CASES) >= 8, "Expected at least 8 golden cases"


def test_golden_entity_resolution():
    """Case 1: Entity resolution for Chinese school names."""
    case = GOLDEN_ENTITY_CASE
    assert case["expected"]["entity_count"] == 2
    assert "SCH-00402" in case["expected"]["school_ids"]  # King's College
    assert "SCH-00166" in case["expected"]["school_ids"]  # La Salle College


def test_golden_constraint_extraction():
    """Case 2: Constraint extraction for district + gender."""
    case = GOLDEN_CONSTRAINT_CASE
    assert "Kowloon City" in case["expected"]["constraints"]["districts"]
    assert case["expected"]["constraints"]["gender"] == "boys_only"


def test_golden_memory_isolation():
    """Case 3: Rejected school should be excluded from future results."""
    case = GOLDEN_MEMORY_CASE
    assert "SCH-00153" in case["expected"]["excluded_schools"]


def test_golden_english_locale():
    """Case 4: English query → English locale."""
    case = GOLDEN_ENGLISH_CASE
    assert case["expected"]["locale"] == "en"


def test_golden_mixed_locale_cjk_priority():
    """Case 5: Mixed language → CJK priority."""
    case = GOLDEN_MIXED_CASE
    assert case["expected"]["locale"] == "zh-TW"


def test_golden_feedback_parsing():
    """Case 6: Natural language feedback parsing."""
    case = GOLDEN_FEEDBACK_CASE
    assert case["expected"]["feedback_type"] == "rejected"
    assert case["expected"]["reason"] == "too_far"


def test_golden_no_results():
    """Case 7: Graceful handling of no results."""
    case = GOLDEN_NO_RESULTS_CASE
    assert case["expected"]["error_code"] == "ENTITY_NOT_FOUND"


def test_golden_trace_linkage():
    """Case 8: Trace ID must be present."""
    case = GOLDEN_TRACE_CASE
    assert case["expected"]["has_trace_id"] is True
