# Phase 10.2: Feedback Capture Module
# Captures parent decisions (accepted/rejected/shortlisted) and stores preference memory.
# Does NOT directly modify ranking weights.

import json
from dataclasses import dataclass, field
from typing import Optional


# Valid feedback types
FEEDBACK_ACCEPTED = "accepted"
FEEDBACK_REJECTED = "rejected"
FEEDBACK_SHORTLISTED = "shortlisted"
FEEDBACK_IGNORED = "ignored"

# Valid rejection reasons
REASON_TOO_FAR = "too_far"
REASON_TUITION = "tuition"
REASON_ACADEMIC_FIT = "academic_fit"
REASON_SCHOOL_CULTURE = "school_culture"
REASON_CHILD_PREFERENCE = "child_preference"
REASON_OTHER = "other"

VALID_REASONS = {REASON_TOO_FAR, REASON_TUITION, REASON_ACADEMIC_FIT,
                REASON_SCHOOL_CULTURE, REASON_CHILD_PREFERENCE, REASON_OTHER}

VALID_FEEDBACK_TYPES = {FEEDBACK_ACCEPTED, FEEDBACK_REJECTED, FEEDBACK_SHORTLISTED, FEEDBACK_IGNORED}


@dataclass
class FeedbackEvent:
    """Parent feedback on a recommendation."""
    user_id: str
    session_id: str
    school_id: str
    feedback_type: str  # accepted, rejected, shortlisted, ignored
    reason: str | None = None
    comment: str | None = None
    rating: int | None = None
    locale: str = "zh-TW"  # Phase 10.1.7-E: locale of feedback (for learning analysis)


@dataclass
class PreferenceInsight:
    """Derived preference from feedback."""
    preference_type: str
    preference_value: str
    source: str
    strength: float = 1.0


class FeedbackCapture:
    """Capture parent feedback and update preference memory."""

    def __init__(self, pool_or_conn):
        self.pool = pool_or_conn
        self._is_conn = hasattr(pool_or_conn, 'fetchrow') and not hasattr(pool_or_conn, 'acquire')

    async def _fetchrow(self, query, *args):
        if self._is_conn:
            return await self.pool.fetchrow(query, *args)
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def _fetch(self, query, *args):
        if self._is_conn:
            return await self.pool.fetch(query, *args)
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def _execute(self, query, *args):
        if self._is_conn:
            return await self.pool.execute(query, *args)
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)

    async def capture_feedback(self, event: FeedbackEvent) -> str:
        """Store parent feedback and return feedback_id.

        Also updates preference_memory for future query context.
        """
        # Validate
        if event.feedback_type not in VALID_FEEDBACK_TYPES:
            raise ValueError(f"Invalid feedback_type: {event.feedback_type}")
        if event.reason and event.reason not in VALID_REASONS:
            raise ValueError(f"Invalid reason: {event.reason}")

        # Find result_id from session_id + school_id
        result_id = None
        if event.session_id:
            result = await self._fetchrow(
                """
                SELECT id FROM memory.recommendation_result
                WHERE session_id = $1 AND school_id = $2
                """,
                event.session_id, event.school_id,
            )
            result_id = result["id"] if result else None

        # Insert feedback (result_id may be null for direct feedback without session context)
        # Phase 10.1.7-E: Store locale for learning analysis
        row = await self._fetchrow(
            """
            INSERT INTO memory.recommendation_feedback
                (result_id, user_id, action, feedback_type, reason, comment, rating, locale)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
            """,
            result_id, event.user_id, event.feedback_type,
            event.feedback_type, event.reason, event.comment, event.rating, event.locale,
        )
        feedback_id = str(row["id"])

        # Update session status (only if session_id provided)
        if event.session_id:
            await self._execute(
                """
                UPDATE memory.recommendation_session
                SET status = $2, parent_decision = $2, decided_at = now()
                WHERE id = $1
                """,
                event.session_id, event.feedback_type,
            )

        # Derive preference insights and store
        await self._store_preference(event)

        return feedback_id

    async def _store_preference(self, event: FeedbackEvent):
        """Store derived preference in preference_memory.

        This does NOT modify ranking weights directly.
        Preferences are used as future query context.
        """
        insights = self._derive_preferences(event)

        for insight in insights:
            # Check if preference already exists
            existing = await self._fetchrow(
                """
                SELECT id, strength, feedback_count
                FROM memory.preference_memory
                WHERE user_id = $1 AND preference_type = $2 AND preference_value = $3
                """,
                event.user_id, insight.preference_type, insight.preference_value,
            )

            if existing:
                # Reinforce existing preference (increase strength, cap at 1.0)
                new_strength = min(1.0, existing["strength"] + 0.1)
                new_count = existing["feedback_count"] + 1
                await self._execute(
                    """
                    UPDATE memory.preference_memory
                    SET strength = $1,
                        feedback_count = $2,
                        last_reinforced_at = now()
                    WHERE id = $3
                    """,
                    new_strength, new_count, existing["id"],
                )
            else:
                # Create new preference
                await self._execute(
                    """
                    INSERT INTO memory.preference_memory
                        (user_id, preference_type, preference_value, source, strength)
                    VALUES ($1, $2, $3, $4, $5)
                    """,
                    event.user_id, insight.preference_type,
                    insight.preference_value, insight.source, insight.strength,
                )

    def _derive_preferences(self, event: FeedbackEvent) -> list[PreferenceInsight]:
        """Derive preference insights from feedback event."""
        insights = []

        if event.feedback_type == FEEDBACK_ACCEPTED:
            insights.append(PreferenceInsight(
                preference_type="school",
                preference_value=event.school_id,
                source="feedback_accepted",
                strength=1.0,
            ))
        elif event.feedback_type == FEEDBACK_REJECTED:
            insights.append(PreferenceInsight(
                preference_type="avoid",
                preference_value=event.school_id,
                source="feedback_rejected",
                strength=0.8,
            ))
            # If reason provided, capture reason-based preference
            if event.reason == REASON_TOO_FAR:
                insights.append(PreferenceInsight(
                    preference_type="location_sensitivity",
                    preference_value="high",
                    source="feedback_rejected",
                    strength=0.7,
                ))
            elif event.reason == REASON_TUITION:
                insights.append(PreferenceInsight(
                    preference_type="tuition_sensitivity",
                    preference_value="high",
                    source="feedback_rejected",
                    strength=0.7,
                ))
            elif event.reason == REASON_ACADEMIC_FIT:
                insights.append(PreferenceInsight(
                    preference_type="academic_priority",
                    preference_value="high",
                    source="feedback_rejected",
                    strength=0.7,
                ))
            elif event.reason == REASON_CHILD_PREFERENCE:
                insights.append(PreferenceInsight(
                    preference_type="child_autonomy",
                    preference_value="high",
                    source="feedback_rejected",
                    strength=0.7,
                ))
        elif event.feedback_type == FEEDBACK_SHORTLISTED:
            insights.append(PreferenceInsight(
                preference_type="shortlist",
                preference_value=event.school_id,
                source="feedback_shortlisted",
                strength=0.6,
            ))

        return insights

    async def get_user_preferences(self, user_id: str) -> list[dict]:
        """Get user preferences for future query context."""
        rows = await self._fetch(
            """
            SELECT preference_type, preference_value, source, strength, feedback_count
            FROM memory.preference_memory
            WHERE user_id = $1
            ORDER BY strength DESC, last_reinforced_at DESC
            """,
            user_id,
        )
        return [dict(r) for r in rows]

    async def get_preference_context(self, user_id: str) -> Optional[dict]:
        """Get preference context dict for engine pipeline.

        Returns None if no preferences exist.
        """
        prefs = await self.get_user_preferences(user_id)
        if not prefs:
            return None

        context = {
            "avoid_schools": [],
            "shortlist_schools": [],
            "location_sensitivity": None,
            "tuition_sensitivity": None,
            "academic_priority": None,
            "child_autonomy": None,
        }

        for p in prefs:
            if p["preference_type"] == "avoid":
                context["avoid_schools"].append(p["preference_value"])
            elif p["preference_type"] == "shortlist":
                context["shortlist_schools"].append(p["preference_value"])
            elif p["preference_type"] == "location_sensitivity":
                context["location_sensitivity"] = p["preference_value"]
            elif p["preference_type"] == "tuition_sensitivity":
                context["tuition_sensitivity"] = p["preference_value"]
            elif p["preference_type"] == "academic_priority":
                context["academic_priority"] = p["preference_value"]
            elif p["preference_type"] == "child_autonomy":
                context["child_autonomy"] = p["preference_value"]

        return context


def get_feedback_capture(pool_or_conn) -> FeedbackCapture:
    """Factory function."""
    return FeedbackCapture(pool_or_conn)
