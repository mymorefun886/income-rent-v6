# Phase 10.2.1: Feedback Intent Parser
# Parses natural language parent feedback into structured feedback events.
# Version 1: Simple keyword matching — no LLM needed.

from dataclasses import dataclass, field
from typing import Optional


# Feedback type signals
FEEDBACK_SIGNALS = {
    "accepted": [
        "好", "鍾意", "喜歡", "啱", "合適", "可以", "考慮", "接受", "要", "選", "報",
        "good", "like", "love", "great", "perfect", "yes", "accept", "interested",
        "👍", "✅", "👌",
    ],
    "rejected": [
        "唔好", "唔鍾意", "唔喜歡", "唔啱", "唔合適", "唔考慮", "唔要", "拒絕", "排除",
        "bad", "no", "reject", "pass", "not interested", "nope",
        "👎", "❌",
        "太遠", "太貴", "唔鍾", "唔好睇", "唔考慮", "唔啱", "唔要",
    ],
    "shortlisted": [
        "收藏", "bookmark", "save", "稍後", "睇下", "研究", "了解",
        "📌", "🔖",
    ],
}

# Rejection reason signals
REASON_SIGNALS = {
    "too_far": [
        "遠", "距離", "位置", "交通", "時間", "屋企", "屋企附近", "社區",
        "far", "distance", "location", "transport", "travel", "commute",
    ],
    "tuition": [
        "貴", "學費", "費用", "錢", "負擔", "經濟", "平價", "資助",
        "expensive", "fee", "cost", "price", "afford", "budget", "money",
    ],
    "academic_fit": [
        "成績", "學術", "程度", "level", "band", "banding", "競爭", "壓力",
        "academic", "standard", "performance", "competitive", "pressure",
    ],
    "school_culture": [
        "文化", "校風", "氣氛", "環境", "宗教", "教會", "天主教", "基督教",
        "culture", "environment", "atmosphere", "religion", "catholic", "christian",
    ],
    "child_preference": [
        "仔女", "仔", "女", "小朋友", "孩子", "不想", "唔想", "不想揀",
        "child", "kid", "son", "daughter", "want", "prefer",
    ],
}


@dataclass
class FeedbackIntent:
    """Parsed feedback intent from natural language."""
    feedback_type: str = ""  # accepted, rejected, shortlisted, unknown
    reason: str | None = None
    confidence: float = 0.0
    matched_signals: list[str] = field(default_factory=list)


def parse_feedback_intent(text: str) -> FeedbackIntent:
    """Parse natural language parent feedback into structured intent.

    Examples:
        "呢間太遠" → rejected, too_far
        "好鍾意" → accepted
        "唔啱我仔" → rejected, child_preference
        "學費太貴" → rejected, tuition
        "收藏稍後睇" → shortlisted
    """
    if not text:
        return FeedbackIntent()

    intent = FeedbackIntent()
    text_lower = text.lower()

    # Score each feedback type
    type_scores = {}
    for fb_type, signals in FEEDBACK_SIGNALS.items():
        matches = [s for s in signals if s in text_lower]
        if matches:
            type_scores[fb_type] = len(matches)

    if type_scores:
        # Take highest scoring type
        intent.feedback_type = max(type_scores, key=type_scores.get)
        intent.matched_signals = [
            s for s in FEEDBACK_SIGNALS[intent.feedback_type] if s in text_lower
        ]
        intent.confidence = min(1.0, 0.5 + len(intent.matched_signals) * 0.15)

    # Only detect reason for rejected feedback
    if intent.feedback_type == "rejected":
        reason_scores = {}
        for reason, signals in REASON_SIGNALS.items():
            matches = [s for s in signals if s in text_lower]
            if matches:
                reason_scores[reason] = len(matches)

        if reason_scores:
            intent.reason = max(reason_scores, key=reason_scores.get)

    return intent


def is_feedback_message(text: str) -> bool:
    """Quick check if message is likely a feedback response."""
    if not text:
        return False

    text_lower = text.lower()

    # Check for feedback signals
    for signals in FEEDBACK_SIGNALS.values():
        if any(s in text_lower for s in signals):
            return True

    # Check for reason signals (often appear with implicit rejection)
    for signals in REASON_SIGNALS.values():
        if any(s in text_lower for s in signals):
            return True

    return False
