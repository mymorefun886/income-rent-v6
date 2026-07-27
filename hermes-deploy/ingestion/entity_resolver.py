# Hermes Ingestion — School Entity Resolver
# Resolves CHSC school names (EN/TC/SC) to canonical school_id.
#
# Pipeline:
#   raw_name → unicode normalize → strip punctuation → lowercase →
#   script detect → Hans→Hant conversion → identity_map lookup →
#   alias lookup → new entity

import logging
import re
import unicodedata

from pg_writer import (
    lookup_by_normalized_name,
    lookup_by_alias,
    insert_alias,
    upsert_identity,
    get_next_school_id,
)
from models import SchoolIdentityEntry

logger = logging.getLogger("hermes.ingestion.entity_resolver")

# Simple CJK character ranges for script detection
_CJK_RANGES = [
    (0x4E00, 0x9FFF),   # CJK Unified
    (0x3400, 0x4DBF),   # CJK Unified Extension A
    (0x20000, 0x2A6DF), # CJK Unified Extension B
]

# Common Chinese → Latin name mappings for known abbreviations
# Populated as we encounter them; this is a bootstrap, not exhaustive
_KNOWN_ALIASES: dict[str, str] = {
    # Normalized alias → school_id (filled at runtime from DB)
}


def _unicode_normalize(name: str) -> str:
    """NFC normalize."""
    return unicodedata.normalize("NFC", name)


def _strip_punctuation(name: str) -> str:
    """Remove common punctuation that varies between languages."""
    name = re.sub(r"['',\.\-\(\)\[\]（）「」『』""''—–‘’“”]", " ", name)
    name = re.sub(r"\s+", " ", name)
    return name.strip()


def _normalize_for_match(name: str) -> str:
    """Full normalization chain for DB lookup."""
    name = _unicode_normalize(name)
    name = _strip_punctuation(name)
    name = name.lower().strip()
    return name


def _is_cjk(name: str) -> bool:
    """Check if string contains CJK characters."""
    for ch in name:
        cp = ord(ch)
        for lo, hi in _CJK_RANGES:
            if lo <= cp <= hi:
                return True
    return False


def _detect_language(name: str) -> str:
    """Detect name language: 'en', 'zh-Hant', 'zh-Hans'."""
    if not _is_cjk(name):
        return "en"
    # Simplified detection: check for simplified-specific characters
    # 学, 书, 国, 体, 华 → Simplified; 學, 書, 國, 體, 華 → Traditional
    simplified_chars = set("学书国体华发关会门")
    traditional_chars = set("學書國體華發關會門")
    has_simp = any(ch in simplified_chars for ch in name)
    has_trad = any(ch in traditional_chars for ch in name)
    if has_simp and not has_trad:
        return "zh-Hans"
    return "zh-Hant"


# Simplified → Traditional character mapping (extensible)
_SIMP_TO_TRAD: dict[str, str] = {
    "学": "學", "书": "書", "国": "國", "体": "體", "华": "華",
    "发": "發", "关": "關", "会": "會", "门": "門", "开": "開",
    "区": "區", "东": "東", "车": "車", "长": "長", "风": "風",
    "电": "電", "对": "對", "导": "導", "岛": "島", "动": "動",
    "尔": "爾", "广": "廣", "汉": "漢", "号": "號", "后": "後",
    "机": "機", "几": "幾", "记": "記", "际": "際", "节": "節",
    "进": "進", "经": "經", "旧": "舊", "军": "軍", "乐": "樂",
    "离": "離", "里": "裡", "历": "歷", "联": "聯", "马": "馬",
    "么": "麼", "万": "萬", "网": "網", "为": "為", "卫": "衛",
    "无": "無", "显": "顯", "义": "義", "应": "應", "云": "雲",
    "证": "證", "质": "質", "专": "專", "厂": "廠", "处": "處",
    "县": "縣", "台": "臺", "庄": "莊", "丰": "豐", "农": "農",
    "亚": "亞", "圣": "聖", "园": "園", "远": "遠", "际": "際",
    "页": "頁", "飞": "飛", "龙": "龍", "罗": "羅", "刘": "劉",
    "赵": "趙", "陈": "陳", "张": "張", "杨": "楊", "黄": "黃",
    "郑": "鄭", "邓": "鄧", "冯": "馮", "许": "許", "谢": "謝",
    "韩": "韓", "孙": "孫", "沈": "沈", "钱": "錢", "吴": "吳",
    "坛": "壇", "庙": "廟", "岗": "崗", "岭": "嶺", "观": "觀",
    "证": "證", "记": "記", "识": "識", "译": "譯", "议": "議",
    "讲": "講", "读": "讀", "课": "課", "谁": "誰", "谈": "談",
    "调": "調", "论": "論", "请": "請", "诺": "諾", "谢": "謝",
    "语": "語", "说": "說", "让": "讓", "认": "認", "试": "試",
    "诗": "詩", "诚": "誠", "话": "話", "该": "該", "详": "詳",
    "护": "護", "变": "變", "实": "實", "审": "審", "写": "寫",
    "证": "證", "识": "識", "计": "計", "设": "設", "访": "訪",
    "评": "評", "诉": "訴", "诊": "診", "词": "詞", "译": "譯",
    "诗": "詩", "诚": "誠", "详": "詳", "调": "調", "谈": "談",
}

# Additional common simplified→traditional school name characters
_SCHOOL_SIMP_TO_TRAD: dict[str, str] = {
    "纪": "紀", "念": "念", "侨": "僑", "庆": "慶", "誉": "譽",
    "赞": "讚", "观": "觀", "览": "覽", "览": "覽", "觉": "覺",
    "医": "醫", "药": "藥", "妇": "婦", "儿": "兒", "难": "難",
    "边": "邊", "达": "達", "运": "運", "过": "過", "还": "還",
    "进": "進", "远": "遠", "连": "連", "选": "選", "适": "適",
}
_SIMP_TO_TRAD.update(_SCHOOL_SIMP_TO_TRAD)


def _simplified_to_traditional(text: str) -> str:
    """Convert simplified Chinese characters to traditional."""
    result = []
    for ch in text:
        result.append(_SIMP_TO_TRAD.get(ch, ch))
    return "".join(result)


def _compute_school_id(name: str) -> str:
    """Generate a new school_id. Uses DB sequence."""
    return get_next_school_id()


def resolve(name: str, language: str | None = None, source: str = "") -> tuple[str, bool]:
    """Resolve a school name to a canonical school_id.

    Args:
        name: Raw school name from CSV.
        language: 'en', 'zh-Hant', 'zh-Hans', or None for auto-detect.
        source: Source identifier (e.g. 'CHSC_CSV_EN').

    Returns:
        (school_id, is_new) — school_id and whether a new entity was created.
    """
    detected_lang = language or _detect_language(name)
    normalized = _normalize_for_match(name)

    # Step 1: Direct normalized name lookup
    existing = lookup_by_normalized_name(normalized)
    if existing:
        return existing, False

    # Step 2: If Simplified Chinese, convert to Traditional and try again
    if detected_lang == "zh-Hans":
        trad_name = _simplified_to_traditional(name)
        trad_normalized = _normalize_for_match(trad_name)
        if trad_normalized != normalized:
            existing = lookup_by_normalized_name(trad_normalized)
            if existing:
                # Found via traditional conversion — record the simplified entry
                upsert_identity(SchoolIdentityEntry(
                    school_id=existing, language="zh-Hans",
                    name=name, normalized_name=normalized,
                    source=source, confidence=0.9,
                ))
                return existing, False

    # Step 3: Alias lookup
    existing = lookup_by_alias(normalized)
    if existing:
        return existing, False

    # Step 4: New entity
    school_id = _compute_school_id(name)
    logger.info("New school entity: %s → %s", school_id, name)
    return school_id, True


def resolve_batch(names_and_langs: list[tuple[str, str, str]]) -> list[tuple[str, bool]]:
    """Resolve a batch of school names. Each item: (name, language, source)."""
    results = []
    for name, lang, source in names_and_langs:
        school_id, is_new = resolve(name, lang, source)
        results.append((school_id, is_new))
    return results
