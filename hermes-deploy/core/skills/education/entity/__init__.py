# Education Entity Package
# Entity Intelligence for school name resolution

from .resolver import EntityResolver, ResolvedEntity
from .alias_matcher import AliasMatcher, AliasMatch, EntityResolution
from .entity_detector import EntityIntent, detect_entity_intent
from .comparison import (
    SchoolComparisonData,
    generate_comparison,
    school_data_to_comparison,
)
from .normalize import (
    normalize_for_matching,
    normalize_preserving_case,
    normalize_unicode,
    normalize_traditional_simplified,
    normalize_punctuation,
)

__all__ = [
    "EntityResolver",
    "ResolvedEntity",
    "AliasMatcher",
    "AliasMatch",
    "EntityResolution",
    "EntityIntent",
    "detect_entity_intent",
    "SchoolComparisonData",
    "generate_comparison",
    "school_data_to_comparison",
    "normalize_for_matching",
    "normalize_preserving_case",
    "normalize_unicode",
    "normalize_traditional_simplified",
    "normalize_punctuation",
]
