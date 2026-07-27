# Hermes Core — Task Router
# Intent detection + skill selection via Skill Registry

from context import TaskContext
from skills.registry import registry

# Keyword-based intent map (will evolve to LLM-based in Phase 5)
INTENT_MAP = {
    # education
    "學校": ("education", 0.9),
    "書院": ("education", 0.9),
    "升學": ("education", 0.85),
    "幼稚園": ("education", 0.85),
    "小學": ("education", 0.85),
    "中學": ("education", 0.85),
    "IB": ("education", 0.85),
    "DSE": ("education", 0.85),
    "選校": ("education", 0.9),
    "教育": ("education", 0.9),
    # education (English)
    "school": ("education", 0.85),
    "education": ("education", 0.8),
    "kindergarten": ("education", 0.85),
    "primary": ("education", 0.8),
    "secondary": ("education", 0.8),
    "band 1": ("education", 0.85),
    "band 2": ("education", 0.85),
    "band 3": ("education", 0.85),
    "admission": ("education", 0.8),
    "college": ("education", 0.8),
    "tution": ("education", 0.75),
    # investment
    "投資": ("investment", 0.85),
    "股票": ("investment", 0.85),
    "市場": ("investment", 0.7),
    "港股": ("investment", 0.85),
    "美股": ("investment", 0.85),
    # commerce
    "電商": ("commerce", 0.85),
    "shopee": ("commerce", 0.9),
    "ebay": ("commerce", 0.9),
    "產品": ("commerce", 0.75),
    "定價": ("commerce", 0.8),
    # personal
    "個人": ("personal", 0.8),
    "家庭": ("personal", 0.8),
    "日曆": ("personal", 0.8),
    "提醒": ("personal", 0.85),
    # analysis (domain-agnostic)
    "分析": ("analysis", 0.7),
}

# Education context signals for scoring (Phase 10.1.7-B)
# These supplement the keyword map for implicit education queries
EDUCATION_CONTEXT_SIGNALS = {
    # Child reference (strong indicators)
    "孩子": 0.3, "仔": 0.3, "女": 0.3, "阿仔": 0.35, "阿女": 0.35,
    "兒子": 0.3, "女兒": 0.3, "小朋友": 0.25, "細路": 0.25,
    "child": 0.25, "children": 0.25, "son": 0.25, "daughter": 0.25,
    # Education domain
    "學校": 0.4, "升學": 0.4, "選校": 0.4, "中學": 0.35, "小學": 0.35,
    "幼稚園": 0.35, "幼兒園": 0.35, "升中": 0.4, "升小": 0.4,
    "叩門": 0.35, "派位": 0.35, "校網": 0.35,
    "school": 0.3, "education": 0.35, "admission": 0.3,
    # Interest/subject signals
    "喜歡": 0.15, "興趣": 0.2, "科學": 0.2, "音樂": 0.2, "運動": 0.2,
    "體育": 0.2, "藝術": 0.2, "stem": 0.25, "science": 0.2,
    "math": 0.2, "music": 0.2, "sports": 0.2, "arts": 0.2,
    # Grade/age signals
    "年級": 0.25, "grade": 0.2, "小一": 0.3, "小六": 0.3, "中一": 0.3, "中六": 0.3,
}

EDUCATION_CONTEXT_THRESHOLD = 0.55


def _education_context_score(query: str) -> float:
    """Score query for education context (0.0 to 1.0).

    Used to detect implicit education queries like "我個仔喜歡科學"
    that don't contain explicit education keywords.
    """
    if not query:
        return 0.0

    query_lower = query.lower()
    score = 0.0

    for signal, weight in EDUCATION_CONTEXT_SIGNALS.items():
        if signal in query_lower:
            score += weight

    return min(1.0, score)


def detect_intent(ctx: TaskContext) -> TaskContext:
    """Detect intent from raw message using keyword + context scoring."""
    msg_lower = ctx.raw_message.lower()

    best_intent = "general"
    best_score = 0.0

    # Phase 1: Keyword matching
    for keyword, (intent, score) in INTENT_MAP.items():
        if keyword.lower() in msg_lower:
            if score > best_score:
                best_score = score
                best_intent = intent

    # Phase 2: Education context scoring (for implicit education queries)
    # If keyword matching found nothing strong, check education context
    if best_score < 0.7:
        edu_score = _education_context_score(ctx.raw_message)
        if edu_score >= EDUCATION_CONTEXT_THRESHOLD and edu_score > best_score:
            best_intent = "education"
            best_score = edu_score

    ctx.intent = best_intent
    ctx.intent_confidence = best_score
    ctx.domain = best_intent
    return ctx


def select_skill(ctx: TaskContext) -> TaskContext:
    """Match intent/domain to a registered skill. Falls back to general."""
    skill = registry.find_by_intent(ctx.intent) or registry.find_by_domain(ctx.domain)
    if skill:
        ctx.selected_skill = skill.name
    else:
        ctx.selected_skill = "general"

    ctx.skill_args = {
        "user_id": ctx.user_id,
        "message": ctx.raw_message,
        "source": ctx.source,
        "domain": ctx.domain,
    }
    return ctx
