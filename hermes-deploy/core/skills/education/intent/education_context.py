# Education Intent — Education Context Scoring
# Determines if a query should route to education domain based on context signals.

from dataclasses import dataclass, field
from typing import Optional

# Signal weights for education context scoring
# Higher weight = stronger signal that query is about education
EDUCATION_CONTEXT_SIGNALS = {
    # Child reference (strongest signal)
    "孩子": 0.3,
    "仔": 0.3,
    "女": 0.3,
    "阿仔": 0.35,
    "阿女": 0.35,
    "兒子": 0.3,
    "女兒": 0.3,
    "小朋友": 0.25,
    "細路": 0.25,
    "child": 0.25,
    "children": 0.25,
    "son": 0.25,
    "daughter": 0.25,

    # Education domain keywords
    "學校": 0.4,
    "升學": 0.4,
    "選校": 0.4,
    "中學": 0.35,
    "小學": 0.35,
    "幼稚園": 0.35,
    "幼兒園": 0.35,
    "school": 0.3,
    "education": 0.35,
    "admission": 0.3,
    "升中": 0.4,
    "升小": 0.4,
    "叩門": 0.35,
    "派位": 0.35,
    "校網": 0.35,
    "banding": 0.25,
    "band 1": 0.25,
    "band 2": 0.2,
    "band 3": 0.2,

    # Interest/subject signals (moderate)
    "喜歡": 0.15,
    "興趣": 0.2,
    "科學": 0.2,
    "音樂": 0.2,
    "運動": 0.2,
    "體育": 0.2,
    "藝術": 0.2,
    "stem": 0.25,
    "science": 0.2,
    "math": 0.2,
    "music": 0.2,
    "sports": 0.2,
    "arts": 0.2,
    "interest": 0.15,

    # Location signals (weak alone, but combined with others)
    "地區": 0.1,
    "校網": 0.15,
    "district": 0.1,
    "九龍": 0.1,
    "香港": 0.05,
    "新界": 0.1,

    # Grade/age signals
    "年級": 0.25,
    "grade": 0.2,
    "k1": 0.2,
    "k2": 0.2,
    "k3": 0.2,
    "小一": 0.3,
    "小二": 0.3,
    "小三": 0.3,
    "小四": 0.3,
    "小五": 0.3,
    "小六": 0.3,
    "中一": 0.3,
    "中二": 0.3,
    "中三": 0.3,
    "中四": 0.3,
    "中五": 0.3,
    "中六": 0.3,
}

# Thresholds for routing decisions
EDUCATION_ROUTE_THRESHOLD = 0.55  # Score above this → route to education
EDUCATION_INTEREST_THRESHOLD = 0.15  # Minimum interest signal to extract interest


@dataclass
class EducationContextResult:
    """Result of education context scoring."""
    score: float = 0.0
    is_education: bool = False
    matched_signals: dict = field(default_factory=dict)
    extracted_interests: list = field(default_factory=list)
    confidence: float = 0.0


def education_context_score(query: str) -> EducationContextResult:
    """Score a query for education context.

    Returns EducationContextResult with score, is_education flag, and matched signals.

    Examples:
        "我個仔喜歡科學" → score=0.7, is_education=True, interests=["科學"]
        "我喜歡科學新聞" → score=0.35, is_education=False
        "九龍城英文中學推薦" → score=0.65, is_education=True
    """
    if not query:
        return EducationContextResult()

    result = EducationContextResult()
    query_lower = query.lower()

    # Score each signal
    for signal, weight in EDUCATION_CONTEXT_SIGNALS.items():
        if signal in query_lower:
            result.matched_signals[signal] = weight
            result.score += weight

    # Cap score at 1.0
    result.score = min(1.0, result.score)

    # Determine if education domain
    result.is_education = result.score >= EDUCATION_ROUTE_THRESHOLD

    # Calculate confidence (based on number and strength of signals)
    if result.matched_signals:
        # More signals = higher confidence, capped at 0.95
        signal_count = len(result.matched_signals)
        avg_weight = result.score / signal_count if signal_count > 0 else 0
        result.confidence = min(0.95, 0.5 + (signal_count * 0.1) + (avg_weight * 0.3))

    # Extract interests (if education context detected)
    if result.is_education:
        result.extracted_interests = _extract_interests(query_lower)

    return result


def _extract_interests(query_lower: str) -> list[str]:
    """Extract education-related interests from query."""
    interest_keywords = {
        "科學": "science",
        "science": "science",
        "stem": "stem",
        "音樂": "music",
        "music": "music",
        "運動": "sports",
        "體育": "sports",
        "sports": "sports",
        "藝術": "arts",
        "arts": "arts",
        "繪畫": "arts",
        "語言": "languages",
        "languages": "languages",
        "數學": "math",
        "math": "math",
        "數學": "math",
        "閱讀": "languages",
        "寫作": "languages",
        "文學": "languages",
    }

    interests = []
    for keyword, interest_type in interest_keywords.items():
        if keyword in query_lower and interest_type not in interests:
            interests.append(interest_type)

    return interests


def should_route_to_education(query: str) -> bool:
    """Quick check if query should route to education domain."""
    return education_context_score(query).is_education


def get_education_context(query: str) -> Optional[dict]:
    """Get education context as dict (for use in engine pipeline).

    Returns None if not education context.
    """
    result = education_context_score(query)
    if not result.is_education:
        return None

    return {
        "score": result.score,
        "confidence": result.confidence,
        "interests": result.extracted_interests,
        "signals": result.matched_signals,
    }
