# Education Engine — Constraint Extractor
# Parses user query into structured constraints for filtering and ranking.
# Keyword-based approach — no LLM needed for Phase 10.1.6.

from dataclasses import dataclass, field


@dataclass
class QueryConstraints:
    """Structured constraints extracted from a user query."""
    districts: list[str] = field(default_factory=list)       # ["Kowloon City"]
    gender: str | None = None                                # "boys_only" | "girls_only" | "co_ed"
    school_types: list[str] = field(default_factory=list)    # ["DSS", "Aided"]
    language: str | None = None                              # "english" | "chinese" | "bilingual"
    interests: list[str] = field(default_factory=list)       # ["stem", "sports"]
    band: str | None = None                                  # "Band 1" | "Band 2" | "Band 3"
    avoid_schools: list[str] = field(default_factory=list)   # Phase 10.2: school_ids to exclude
    shortlist_schools: list[str] = field(default_factory=list)  # Phase 10.2: school_ids shortlisted


# Chinese district name → Qdrant stored value (exact match)
DISTRICT_MAP = {
    "九龍城": "Kowloon City",
    "油尖旺": "Yau Tsim Mong",
    "中西區": "Central & Western",
    "灣仔": "Wan Chai",
    "東區": "Eastern",
    "南區": "Southern",
    "深水埗": "Sham Shui Po",
    "黃大仙": "Wong Tai Sin",
    "觀塘": "Kwun Tong",
    "葵青": "Kwai Tsing",
    "荃灣": "Tsuen Wan",
    "屯門": "Tuen Mun",
    "元朗": "Yuen Long",
    "北區": "North",
    "大埔": "Tai Po",
    "西貢": "Sai Kung",
    "沙田": "Sha Tin",
    "離島": "Islands",
}

# Gender signals
GENDER_SIGNALS = {
    "boys_only": ["男校", "男生", "阿仔", "男仔", "boy"],
    "girls_only": ["女校", "女生", "阿女", "女仔", "girl"],
    "co_ed": ["男女校", "男女", "混合", "co-ed", "coed"],
}

# School type signals
SCHOOL_TYPE_SIGNALS = {
    "Government": ["官立", "官校", "government"],
    "Aided": ["資助", "補助", "aided"],
    "DSS": ["直資", "dss", "direct subsidy"],
    "Private": ["私立", "private"],
    "International": ["國際", "international", "ib"],
}

# Language signals
LANGUAGE_SIGNALS = {
    "english": ["英文中學", "emi", "英文教學", "english", "英文"],
    "chinese": ["中文中學", "cmi", "中文教學", "chinese", "中文"],
    "bilingual": ["中英文", "雙語", "bilingual", "兩文三語"],
}

# Interest → academic_signal payload field name
INTEREST_TO_SIGNAL = {
    "stem": "academic_signal_science_availability",
    "science": "academic_signal_science_availability",
    "科學": "academic_signal_science_availability",
    "科研": "academic_signal_science_availability",
    "sports": "academic_signal_sports",
    "運動": "academic_signal_sports",
    "體育": "academic_signal_sports",
    "跑步": "academic_signal_sports",
    "music": "academic_signal_music",
    "音樂": "academic_signal_music",
    "樂器": "academic_signal_music",
    "唱歌": "academic_signal_music",
    "arts": "academic_signal_arts",
    "藝術": "academic_signal_arts",
    "繪畫": "academic_signal_arts",
    "美術": "academic_signal_arts",
    "languages": "academic_signal_language_strength",
    "文學": "academic_signal_language_strength",
    "閱讀": "academic_signal_language_strength",
    "寫作": "academic_signal_language_strength",
    "外語": "academic_signal_language_strength",
    "日語": "academic_signal_language_strength",
    "法語": "academic_signal_language_strength",
}

# Band signals (for reference — CHSC has no band data, but we capture intent)
BAND_SIGNALS = {
    "Band 1": ["band 1", "band one", "band1", "top school", "elite", "名校"],
    "Band 2": ["band 2", "band two", "band2", "mid-tier"],
    "Band 3": ["band 3", "band three", "band3"],
}


def extract_constraints(query: str, edu_context: dict | None = None,
                       pref_context: dict | None = None) -> QueryConstraints:
    """Parse user query into structured constraints.

    Uses keyword matching against Chinese and English signals.
    If edu_context is provided (from education_context_score), use extracted interests.
    If pref_context is provided (from preference_memory), apply avoid/shortlist.

    Returns QueryConstraints with all detected signals.
    """
    if not query:
        return QueryConstraints()

    msg = query.lower()
    constraints = QueryConstraints()

    # District extraction
    for cn, en in DISTRICT_MAP.items():
        if cn in query or en.lower() in msg:
            if en not in constraints.districts:
                constraints.districts.append(en)

    # Gender extraction
    for gender, signals in GENDER_SIGNALS.items():
        if any(s in query or s in msg for s in signals):
            constraints.gender = gender
            break

    # School type extraction
    for stype, signals in SCHOOL_TYPE_SIGNALS.items():
        if any(s in query or s in msg for s in signals):
            if stype not in constraints.school_types:
                constraints.school_types.append(stype)

    # Language extraction
    for lang, signals in LANGUAGE_SIGNALS.items():
        if any(s in query or s in msg for s in signals):
            constraints.language = lang
            break

    # Interest extraction — use edu_context if available (more reliable)
    if edu_context and edu_context.get("interests"):
        for interest in edu_context["interests"]:
            if interest not in constraints.interests:
                constraints.interests.append(interest)
    else:
        # Fallback to keyword matching
        for keyword, signal_key in INTEREST_TO_SIGNAL.items():
            if keyword in query or keyword in msg:
                # Extract the interest category from signal key
                # e.g., "academic_signal_science_availability" → "science"
                interest = signal_key.replace("academic_signal_", "").replace("_availability", "")
                if interest not in constraints.interests:
                    constraints.interests.append(interest)

    # Band extraction
    for band, signals in BAND_SIGNALS.items():
        if any(s in msg for s in signals):
            constraints.band = band
            break

    # Phase 10.2: Apply preference memory context
    if pref_context:
        if pref_context.get("avoid_schools"):
            constraints.avoid_schools = pref_context["avoid_schools"]
        if pref_context.get("shortlist_schools"):
            constraints.shortlist_schools = pref_context["shortlist_schools"]

    return constraints


def has_constraints(c: QueryConstraints) -> bool:
    """Return True if any constraint was extracted."""
    return bool(c.districts or c.gender or c.school_types or
                c.language or c.interests or c.band or c.avoid_schools)
