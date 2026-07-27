# Hermes Core — Context Extractor
# Rule-based extraction of decision anchors from conversation state.
# Extracts decision-relevant context that persists beyond session TTL.

import re
from context import TaskContext

# Score threshold — only extract anchors when confidence meets this bar
ANCHOR_MIN_CONFIDENCE = 0.3
ANCHOR_MIN_IMPORTANCE = 0.3

# School name patterns for entity dedup
_SCHOOL_SUFFIX = r'(?:學校|学校|書院|书院|中學|中学|小學|小学|幼稚園|幼稚园|紀念中學|纪念中学|官立中學|官立中学|College|School|Academy)'
_SCHOOL_RE = re.compile(r'([一-鿿]{2,6}' + _SCHOOL_SUFFIX + r')')

# Prefixes and conjunctions to strip from regex-matched school names
_STRIP_PREFIXES = ['分析', '查', '推薦', '推荐', '介紹', '介绍', '幫我', '帮我',
                   '同', '和', '與', '与', '及', '以及', '比較', '比较']


def _clean_school_name(name: str) -> str:
    """Loop-until-dry prefix/conjunction stripping from school name."""
    changed = True
    while changed:
        changed = False
        for prefix in _STRIP_PREFIXES:
            if name.startswith(prefix):
                name = name[len(prefix):]
                changed = True
                break
    return name


def extract_anchors(ctx: TaskContext) -> list[dict] | None:
    """Extract decision anchors from the current turn context.

    Returns a list of anchor dicts to upsert, or None if nothing worth persisting.
    Only extracts anchors for domain-specific decision contexts (not general chat).
    """
    if ctx.domain == "general" or ctx.intent_confidence < ANCHOR_MIN_CONFIDENCE:
        return None

    domain = ctx.domain
    extractors = {
        "education": _extract_education,
        "investment": _extract_investment,
        "commerce": _extract_commerce,
    }

    extractor = extractors.get(domain)
    if extractor is None:
        return None

    anchors = extractor(ctx)
    return anchors


def _extract_education(ctx: TaskContext) -> list[dict] | None:
    """Extract education decision context anchors."""
    # Collect school entities from message + active entity
    schools = set()

    # From message
    for match in _SCHOOL_RE.findall(ctx.raw_message):
        cleaned = _clean_school_name(match)
        if cleaned:
            schools.add(cleaned)

    # From active entity (carried from prior turns)
    if ctx.active_entity and _SCHOOL_RE.search(str(ctx.active_entity)):
        schools.add(ctx.active_entity)

    # From recalled profile
    district = ctx.recalled_profile.get("district", {}).get("value", "") if isinstance(ctx.recalled_profile.get("district"), dict) else ctx.recalled_profile.get("district", "")
    budget = ctx.recalled_profile.get("budget", {}).get("value", "") if isinstance(ctx.recalled_profile.get("budget"), dict) else ctx.recalled_profile.get("budget", "")
    child_age = ctx.recalled_profile.get("child_age", {}).get("value", "") if isinstance(ctx.recalled_profile.get("child_age"), dict) else ctx.recalled_profile.get("child_age", "")

    # From preferences list
    if not district:
        for p in ctx.recalled_preferences:
            if p.get("key") == "district":
                district = p.get("value", "")
            elif p.get("key") == "budget":
                budget = p.get("value", "")
            elif p.get("key") == "child_age":
                child_age = p.get("value", "")

    context_data = {
        "active_entity": ctx.active_entity or "",
        "last_intent": ctx.intent or "",
        "district": str(district) if district else "",
        "budget": str(budget) if budget else "",
        "child_age": str(child_age) if child_age else "",
    }

    # Remove empty values
    context_data = {k: v for k, v in context_data.items() if v}

    # Importance: higher if we have school names + profile data
    importance = 0.5
    if schools:
        importance += 0.2
    if district or budget:
        importance += 0.2
    if ctx.intent_confidence > 0.7:
        importance += 0.1
    importance = min(importance, 1.0)

    if importance < ANCHOR_MIN_IMPORTANCE:
        return None

    return [{
        "domain": "education",
        "anchor_type": "decision_context",
        "entities": sorted(schools),
        "context_data": context_data,
        "importance": importance,
    }]


def _extract_investment(ctx: TaskContext) -> list[dict] | None:
    # Stub — placeholder for future investment decision tracking
    if not ctx.active_entity:
        return None
    return [{
        "domain": "investment",
        "anchor_type": "decision_context",
        "entities": [ctx.active_entity],
        "context_data": {"last_intent": ctx.intent or ""},
        "importance": 0.4,
    }]


def _extract_commerce(ctx: TaskContext) -> list[dict] | None:
    # Stub — placeholder for future commerce decision tracking
    if not ctx.active_entity:
        return None
    return [{
        "domain": "commerce",
        "anchor_type": "decision_context",
        "entities": [ctx.active_entity],
        "context_data": {"last_intent": ctx.intent or ""},
        "importance": 0.4,
    }]
