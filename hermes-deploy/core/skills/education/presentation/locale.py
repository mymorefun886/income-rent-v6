# Phase 10.1.7-D: Education Response Localization Layer
# Detects query language and selects appropriate response formatter.
# Enhanced: Multi-signal locale resolution (user preference + query content)

import re
from typing import Optional


def detect_locale(query: str) -> str:
    """Detect response locale from query content.

    Rules:
        - Contains CJK characters → zh-TW (Traditional Chinese)
        - Otherwise → en

    Examples:
        "比較英皇書院和喇沙書院" → "zh-TW"
        "compare King's College and La Salle" → "en"
        "九龍城英文中學推薦" → "zh-TW"
    """
    if not query:
        return "en"

    # Check for CJK characters (Chinese, Japanese, Kanji)
    # Range: 一-鿿 (CJK Unified Ideographs)
    if re.search(r'[一-鿿]', query):
        return "zh-TW"

    return "en"


def resolve_locale(
    query: str,
    user_locale: Optional[str] = None,
    telegram_language: Optional[str] = None,
    default: str = "zh-TW",
) -> str:
    """Resolve locale from multiple signals.

    Priority:
        1. User preference memory (personal AI OS — user has profile)
        2. Telegram language setting
        3. Query language detection (CJK check)
        4. Default (zh-TW for Hong Kong parents)

    Args:
        query: User's raw message
        user_locale: Stored user preference (e.g., "zh-TW", "en")
        telegram_language: Telegram language code (e.g., "zh-hant", "en")
        default: Fallback locale

    Returns:
        Resolved locale string: "zh-TW" or "en"

    Examples:
        ("Compare 英皇書院", "en", None) → "en"  (user prefers English)
        ("Compare 英皇書院", None, None) → "zh-TW"  (query has CJK)
        ("Compare schools", None, "zh-hant") → "zh-TW"  (Telegram lang)
        ("Compare schools", None, None) → "zh-TW"  (default for HK)
    """
    # Priority 1: User preference memory
    if user_locale:
        return _normalize_locale(user_locale)

    # Priority 2: Telegram language
    if telegram_language:
        locale = _telegram_language_to_locale(telegram_language)
        if locale:
            return locale

    # Priority 3: Query language detection
    return detect_locale(query)


def get_school_name(school: dict, locale: str, school_alias_map: dict = None) -> str:
    """Get localized school name.

    Args:
        school: School data dict with 'school_id', 'name', optional 'name_tc'
        locale: 'zh-TW' or 'en'
        school_alias_map: Optional dict of {school_id: {locale: name}}

    Returns:
        Localized name string
    """
    if locale == "zh-TW":
        # Priority: name_tc field → alias map → fallback to English name
        if school.get("name_tc"):
            return school["name_tc"]
        if school_alias_map and school.get("school_id") in school_alias_map:
            names = school_alias_map[school["school_id"]]
            if "zh" in names:
                return names["zh"]
            if "zh-TW" in names:
                return names["zh-TW"]
        # Fallback: English name (better than nothing)
        return school.get("name", "Unknown School")

    # English (default)
    return school.get("name", "Unknown School")


def _normalize_locale(locale: str) -> str:
    """Normalize locale string to 'zh-TW' or 'en'."""
    locale = locale.lower().strip()
    if locale in ("zh-tw", "zh_tw", "zh-hant", "zh_hant", "zh", "chinese", "tc"):
        return "zh-TW"
    return "en"


def _telegram_language_to_locale(lang: str) -> Optional[str]:
    """Convert Telegram language code to Hermes locale.

    Telegram codes:
        zh-hant → Traditional Chinese (Hong Kong/Taiwan)
        zh-hans → Simplified Chinese
        en → English
    """
    if not lang:
        return None
    lang = lang.lower().strip()
    if lang in ("zh-hant", "zh-hk", "zh-tw"):
        return "zh-TW"
    if lang == "zh-hans":
        return "zh-TW"  # Future: could be "zh-CN" but HK parents use Traditional
    if lang.startswith("en"):
        return "en"
    return None
