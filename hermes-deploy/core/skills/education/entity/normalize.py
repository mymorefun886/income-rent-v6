# Education Entity — Text Normalization Utilities
# Handles Unicode, Traditional/Simplified Chinese, punctuation normalization

import re
import unicodedata


def normalize_unicode(text: str) -> str:
    """Normalize fullwidth characters to halfwidth, NFC form."""
    if not text:
        return ""
    # NFC normalization (composed form)
    text = unicodedata.normalize("NFC", text)
    # Fullwidth → halfwidth conversion
    result = []
    for char in text:
        code = ord(char)
        # Fullwidth ASCII variants (FF01-FF5E) → basic ASCII (0021-007E)
        if 0xFF01 <= code <= 0xFF5E:
            result.append(chr(code - 0xFEE0))
        # Fullwidth space → regular space
        elif code == 0x3000:
            result.append(" ")
        else:
            result.append(char)
    return "".join(result)


def normalize_traditional_simplified(text: str) -> str:
    """Convert Traditional Chinese to Simplified for matching.

    Uses a mapping table for common HK school name characters.
    For production, consider using opencc-python or similar library.
    """
    # Common Traditional → Simplified mappings in HK school names
    trad_to_simp = {
        "英": "英", "華": "华", "皇": "皇", "書": "书", "院": "院",
        "喇": "喇", "沙": "沙", "拔": "拔", "萃": "萃", "男": "男",
        "女": "女", "校": "校", "學": "学", "中": "中", "小": "小",
        "幼": "幼", "稚": "稚", "園": "园", "官": "官", "立": "立",
        "資": "资", "助": "助", "直": "直", "私": "私", "國": "国",
        "際": "际", "龍": "龙", "城": "區", "區": "区", "灣": "湾",
        "油": "油", "尖": "尖", "旺": "旺", "沙": "沙", "田": "田",
        "觀": "观", "塘": "塘", "西": "西", "貢": "贡", "青": "青",
        "島": "岛", "離": "离", "開": "开", "門": "门", "車": "车",
        "馬": "马", "場": "场", "體": "体", "育": "育", "音": "音",
        "樂": "乐", "術": "术", "語": "语", "文": "文", "科": "科",
    }
    return "".join(trad_to_simp.get(c, c) for c in text)


def normalize_punctuation(text: str) -> str:
    """Remove common punctuation and whitespace."""
    # Remove: . , · • ' " - _ ( ) [ ] { } ! ? : ; etc.
    text = re.sub(r"[^\w\s一-鿿]", "", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_for_matching(text: str) -> str:
    """Full normalization pipeline for entity matching.

    Returns lowercase, normalized string suitable for exact/fuzzy matching.
    """
    if not text:
        return ""
    text = normalize_unicode(text)
    text = normalize_traditional_simplified(text)
    text = normalize_punctuation(text)
    text = text.lower()
    return text


def normalize_preserving_case(text: str) -> str:
    """Normalize but preserve case (for display purposes)."""
    if not text:
        return ""
    text = normalize_unicode(text)
    text = normalize_punctuation(text)
    return text
