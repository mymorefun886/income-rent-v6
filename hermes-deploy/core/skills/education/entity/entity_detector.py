# Education Entity — Entity Detector
# Detects if a query is asking for school comparison

import re
from dataclasses import dataclass, field


@dataclass
class EntityIntent:
    """Detected entity intent from query."""
    is_comparison: bool = False
    entities: list[str] = field(default_factory=list)
    intent_type: str = "recommendation"  # recommendation, comparison, inquiry
    raw_query: str = ""


# Comparison patterns (Chinese + English)
COMPARISON_PATTERNS = [
    # English patterns
    r"[Cc]ompare\s+(.+?)\s+(?:and|with|to)\s+(.+?)$",
    r"[Cc]omparison\s+(?:between|of)\s+(.+?)\s+(?:and|vs)\s+(.+?)$",
    r"(.+?)\s+[Vv][Ss]\.?\s+(.+?)$",
    r"[Ww]hich\s+is\s+better[,;]?\s+(.+?)\s+or\s+(.+?)\??",
    r"[Bb]etter\s+(.+?)\s+or\s+(.+?)\??",

    # Chinese patterns
    # 比較 A 和 B
    r"比較\s*(.+?)\s*和\s*(.+?)(?:的|有|哪|$)",
    # 比較 A 與 B
    r"比較\s*(.+?)\s*與\s*(.+?)(?:的|有|哪|$)",
    # A 跟 B（比較）
    r"(.+?)\s*跟\s*(.+?)(?:比較|比|哪個|邊個|$)",
    # A 定 B
    r"(.+?)\s*定\s*(.+?)$",
    # A 還是 B / A 還是 B 好
    r"(.+?)\s*還是\s*(.+?)(?:好|呢|？)?$",
    # A 好定 B 好
    r"(.+?)\s*好定\s*(.+?)\s*好",
    # A 比 B 好/唔好
    r"(.+?)\s*比\s*(.+?)(?:好|唔好|邊個)",
]

# Entity boundary markers (stop words)
ENTITY_BOUNDARIES = [
    "和", "與", "跟", "還是", "定", "比", "vs", "VS", "Vs",
    "比較", "還是", "好", "好唔好", "邊個", "哪個", "哪些",
]


def detect_entity_intent(query: str) -> EntityIntent:
    """Detect if query is asking for school comparison.

    Examples:
        "比較英皇書院和喇沙書院" → comparison, ["英皇書院", "喇沙書院"]
        "英皇定喇沙好？" → comparison, ["英皇", "喇沙"]
        "九龍城英文中學推薦" → recommendation, []
    """
    intent = EntityIntent(raw_query=query)

    if not query or len(query) < 4:
        return intent

    for pattern in COMPARISON_PATTERNS:
        match = re.search(pattern, query)
        if match:
            entity1 = _clean_entity(match.group(1))
            entity2 = _clean_entity(match.group(2))

            if entity1 and entity2 and len(entity1) >= 2 and len(entity2) >= 2:
                intent.is_comparison = True
                intent.intent_type = "comparison"
                intent.entities = [entity1, entity2]
                return intent

    return intent


def _clean_entity(text: str) -> str:
    """Clean extracted entity text."""
    if not text:
        return ""
    # Remove trailing question particles
    text = re.sub(r"[？?呢嗎呀嘅]$", "", text)
    # Remove leading/trailing whitespace
    text = text.strip()
    # Remove trailing comparison words
    for boundary in ["好", "嘅", "的", "呢", "嗎"]:
        if text.endswith(boundary) and len(text) > 2:
            text = text[:-1]
    return text.strip()


def extract_potential_entities(query: str) -> list[str]:
    """Extract potential school names from query (heuristic).

    Used as fallback when comparison pattern doesn't match.
    Looks for Chinese character sequences that could be school names.
    """
    # Match Chinese character sequences (potential school names)
    # School names typically end with 學校, 書院, 中學, 小學, 幼稚園
    school_suffixes = r"(?:學校|書院|中學|小學|幼稚園|學院|大學)"
    pattern = rf"([一-鿿]{{2,}}(?:{school_suffixes})?)"

    matches = re.findall(pattern, query)
    return [m for m in matches if len(m) >= 3]
