# Education Entity — Resolver Pipeline
# Full entity resolution: Normalize → Alias → Identity → Fuzzy → Confidence

from dataclasses import dataclass, field

from .alias_matcher import AliasMatcher, EntityResolution
from .entity_detector import EntityIntent, detect_entity_intent
from .normalize import normalize_for_matching, normalize_preserving_case


@dataclass
class ResolvedEntity:
    """Final resolved entity with all metadata."""
    query_text: str
    school_id: str | None
    confidence: float
    source: str  # alias, identity_map, fuzzy, none
    matched_name: str
    needs_confirmation: bool = False
    alternatives: list = field(default_factory=list)


class EntityResolver:
    """Full entity resolution pipeline.

    Pipeline stages:
        1. Normalize input (Unicode, Trad/Simp, punctuation)
        2. Exact alias lookup (confidence 1.0)
        3. Identity map lookup (confidence 0.95)
        4. Fuzzy fallback (confidence 0.75)
        5. Confidence threshold check (default 0.8)
    """

    CONFIDENCE_THRESHOLD = 0.8

    def __init__(self, pool):
        self.matcher = AliasMatcher(pool)

    async def resolve(self, text: str) -> ResolvedEntity:
        """Resolve a single entity text to school_id."""
        # Stage 1: Normalize
        normalized = normalize_preserving_case(text)

        # Stage 2-4: Match via alias matcher
        result = await self.matcher.resolve(
            normalized,
            min_confidence=self.CONFIDENCE_THRESHOLD,
        )

        # Stage 5: Build final result
        needs_confirmation = result.confidence < self.CONFIDENCE_THRESHOLD

        return ResolvedEntity(
            query_text=text,
            school_id=result.school_id,
            confidence=result.confidence,
            source=result.source,
            matched_name=result.matched_name,
            needs_confirmation=needs_confirmation,
            alternatives=result.alternatives,
        )

    async def resolve_from_intent(self, intent: EntityIntent) -> list[ResolvedEntity]:
        """Resolve all entities from a detected intent."""
        results = []
        for entity_text in intent.entities:
            resolved = await self.resolve(entity_text)
            results.append(resolved)
        return results

    async def resolve_comparison(self, query: str) -> tuple[EntityIntent, list[ResolvedEntity]]:
        """Detect comparison intent and resolve all entities.

        Returns (intent, resolved_entities) tuple.
        """
        intent = detect_entity_intent(query)

        if not intent.is_comparison:
            return intent, []

        resolved = await self.resolve_from_intent(intent)
        return intent, resolved
