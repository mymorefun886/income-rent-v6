# Phase 10.1.7-E: Response Contract
# Defines the structured output format for Education Decision Engine.
# This contract decouples Decision Intelligence from Presentation.
#
# Phase 10.1.9: BACKWARD COMPATIBILITY RULES
# - New fields can be added (forward compatibility)
# - Existing fields CANNOT be removed or renamed
# - schema_version bumps when breaking changes unavoidable
# - v1.0 fields are FROZEN as of Phase 10.1.9

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SchoolRef:
    """Reference to a school in a decision.

    Phase 10.1.9: Fixed entity reference schema.
    - type: entity type (for future multi-entity support)
    - id: canonical ID (stable, names can change)
    - name: display name (locale-aware)
    - confidence: entity resolution confidence
    """
    school_id: str
    name_en: str
    name_tc: str = ""
    type: str = "school"  # Phase 10.1.9: entity type
    confidence: float = 1.0  # Phase 10.1.9: resolution confidence
    locale_source: str = "identity"  # identity, alias, fallback


@dataclass
class DecisionEntity:
    """A single comparison/recommendation target."""
    school: SchoolRef
    total_score: float = 0.0
    component_scores: dict = field(default_factory=dict)
    evidence: list = field(default_factory=list)
    constraint_match: dict = field(default_factory=dict)
    academic_match: dict = field(default_factory=dict)
    reasoning_trace: list = field(default_factory=list)  # Phase 10.1.7-E: from trace


@dataclass
class LocaleContext:
    """Locale resolution context for a decision."""
    resolved_locale: str = "zh-TW"  # zh-TW, en
    source: str = "default"  # user_preference, telegram, query_detection, default
    query_locale: str = ""  # what detect_locale(query) returned
    user_locale: str = ""  # from preference memory (if any)
    telegram_locale: str = ""  # from Telegram (if any)


@dataclass
class DecisionObject:
    """Structured decision output — the Response Contract.

    This is the canonical output of Education Decision Engine.
    Presentation layer formats this into text/JSON/API response.

    Schema versioning (Phase 10.1.9 freeze):
        v1.0: Initial schema — intent, entities, locale, presentation
        Future v1.1+: May ADD fields only (no removal, no rename)

    Backward Compatibility Rules (Phase 10.1.9 FREEZE):
        1. New fields OK (forward-compatible)
        2. Existing fields CANNOT be removed or renamed
        3. Field types should not change
        4. Breaking changes require schema_version bump (v2.0)
        5. Gateway / Telegram / Dashboard must handle missing new fields gracefully

    Structure:
        {
            "schema_version": "1.0",
            "intent": "school_comparison" | "recommendation",
            "entities": [DecisionEntity, ...],
            "locale": LocaleContext,
            "presentation": {
                "locale": "zh-TW",
                "text": "...",
                "format": "text" | "telegram" | "web" | "api"
            },
            "trace_id": "...",  # recommendation_session.id (REQUIRED)
            "user_id": "...",
            "query": "..."
        }
    """
    schema_version: str = "1.0"  # Phase 10.1.9: Schema version for forward compatibility
    intent: str = ""  # school_comparison, recommendation
    entities: list = field(default_factory=list)  # list[DecisionEntity]
    locale: LocaleContext = field(default_factory=LocaleContext)
    presentation: dict = field(default_factory=dict)
    trace_id: str = ""  # REQUIRED: links to recommendation_session.id
    user_id: str = ""
    query: str = ""
    metadata: dict = field(default_factory=dict)

    def to_presentation_text(self) -> str:
        """Get formatted presentation text (locale-aware)."""
        return self.presentation.get("text", "")

    def to_api_response(self) -> dict:
        """Get structured API response.

        Phase 10.1.9: Includes schema_version for forward compatibility.
        Fixed entity reference format with type, id, name, confidence.
        """
        return {
            "schema_version": self.schema_version,
            "intent": self.intent,
            "entities": [
                {
                    "type": e.school.type,
                    "id": e.school.school_id,
                    "name": e.school.name_tc if self.locale.resolved_locale == "zh-TW" and e.school.name_tc else e.school.name_en,
                    "name_en": e.school.name_en,
                    "name_tc": e.school.name_tc,
                    "confidence": e.school.confidence,
                    "total_score": e.total_score,
                    "component_scores": e.component_scores,
                    "constraint_match": e.constraint_match,
                    "academic_match": e.academic_match,
                    "reasoning_trace": e.reasoning_trace,
                }
                for e in self.entities
            ],
            "locale": {
                "resolved": self.locale.resolved_locale,
                "source": self.locale.source,
            },
            "trace_id": self.trace_id,
            "query": self.query,
        }

    def to_telegram_text(self) -> str:
        """Get Telegram-formatted text (Markdown)."""
        # Telegram uses same text but could be customized
        return self.presentation.get("text", "")


@dataclass
class FeedbackEvent:
    """Feedback event with locale context (Phase 10.1.7-E).

    Stores the original locale for learning analysis.
    """
    user_id: str
    school_id: str
    feedback_type: str  # accepted, rejected, shortlisted, ignored
    reason: Optional[str] = None  # too_far, tuition, academic_fit, etc.
    comment: Optional[str] = None  # original text
    locale: str = "zh-TW"  # Phase 10.1.7-E: locale of feedback
    normalized_reason: str = ""  # parsed reason
    confidence: float = 0.0  # parser confidence

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "school_id": self.school_id,
            "feedback_type": self.feedback_type,
            "reason": self.reason,
            "comment": self.comment,
            "locale": self.locale,
            "normalized_reason": self.normalized_reason,
            "confidence": self.confidence,
        }
