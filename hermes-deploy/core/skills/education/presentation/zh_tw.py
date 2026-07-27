# Phase 10.1.7-D: Chinese (Traditional) Response Formatter
# Localized output for Hong Kong parents — decision-oriented, not just translation.


# ── Label mappings ──────────────────────────────────────────

GENDER_LABELS_ZH = {
    "boys_only": "男校",
    "girls_only": "女校",
    "co_ed": "男女校",
}

SCHOOL_TYPE_LABELS_ZH = {
    "Government": "官立學校",
    "Aided": "資助學校",
    "DSS": "直資學校",
    "Private": "私立學校",
    "International": "國際學校",
}

DISTRICT_LABELS_ZH = {
    "Central & Western": "中西區",
    "Wan Chai": "灣仔",
    "Eastern": "東區",
    "Southern": "南區",
    "Yau Tsim Mong": "油尖旺",
    "Sham Shui Po": "深水埗",
    "Kowloon City": "九龍城",
    "Wong Tai Sin": "黃大仙",
    "Kwun Tong": "觀塘",
    "Kwai Tsing": "葵青",
    "Tsuen Wan": "荃灣",
    "Tuen Mun": "屯門",
    "Yuen Long": "元朗",
    "North": "北區",
    "Tai Po": "大埔",
    "Sai Kung": "西貢",
    "Sha Tin": "沙田",
    "Islands": "離島",
}

SIGNAL_LABELS_ZH = {
    "language_strength": "語文能力",
    "science_availability": "科學發展",
    "subject_breadth": "科目多元性",
    "sports": "體育",
    "music": "音樂",
    "arts": "藝術",
}

SIGNAL_LEVEL_ZH = {
    "high": "高",
    "medium": "中",
    "low": "低",
}


def gender_label_zh(gender: str) -> str:
    return GENDER_LABELS_ZH.get(gender, gender)


def school_type_label_zh(school_type: str) -> str:
    return SCHOOL_TYPE_LABELS_ZH.get(school_type, school_type)


def district_label_zh(district: str) -> str:
    return DISTRICT_LABELS_ZH.get(district, district)


def signal_label_zh(signal: str) -> str:
    return SIGNAL_LABELS_ZH.get(signal, signal.replace("_", " ").title())


def signal_level_zh(level: str) -> str:
    return SIGNAL_LEVEL_ZH.get(level, level)


# ── Decision-oriented section headers ──────────────────────

SECTION_HEADERS_ZH = {
    "comparison_title": "=== 學校比較 ===",
    "recommendation_title": "=== 升學推薦 ===",
    "key_differences": "=== 差異重點 ===",
    "district": "📍 地區",
    "type": "🏫 類型",
    "gender": "👦 性別",
    "religion": "⛪ 宗教",
    "academic_signals": "📚 學術特點",
    "facilities": "🏢 校園設施",
    "fees": "💰 學費（S{level}）",
    "overall_score": "整體分數",
    "constraint": "約束匹配",
    "academic": "學術匹配",
    "preference": "偏好匹配",
    "evidence": "證據質量",
    "evidence_trace": "📋 證據追蹤",
    "reasoning": "💡 推薦理由",
    "source": "📊 資料來源：CHSC（家校會）",
    "data_year": "📅 資料年份：2025-2026",
    "suggested_next_steps": "📝 下一步建議",
    "next_steps_list": [
        "參加開放日，親身了解學校文化",
        "預備申請文件（成績表、證書）",
        "諮詢在校家長或校友意見",
        "考慮子女興趣與學校特長匹配",
    ],
}
