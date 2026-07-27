# Phase 10.1.7-D/E: Presentation package init
# Exports locale detection, formatters, and response contract.

from .locale import detect_locale, resolve_locale, get_school_name
from .formatter import format_comparison, format_recommendation
from .contract import DecisionObject, DecisionEntity, SchoolRef, LocaleContext, FeedbackEvent

__all__ = [
    "detect_locale",
    "resolve_locale",
    "get_school_name",
    "format_comparison",
    "format_recommendation",
    "DecisionObject",
    "DecisionEntity",
    "SchoolRef",
    "LocaleContext",
    "FeedbackEvent",
]
