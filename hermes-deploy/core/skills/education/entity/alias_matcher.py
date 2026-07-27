# Education Entity — Alias Matcher
# Matches school aliases from the database with confidence scoring

from dataclasses import dataclass, field

from .normalize import normalize_for_matching, normalize_preserving_case


@dataclass
class AliasMatch:
    """A single alias match result."""
    school_id: str
    alias: str
    alias_normalized: str
    source: str
    confidence: float  # 1.0 = exact official alias, 0.95 = identity map, 0.8 = short name, etc.
    locale: str = "en"  # Phase 10.1.7-E: locale of this alias


@dataclass
class EntityResolution:
    """Complete entity resolution result."""
    query_text: str
    school_id: str | None = None
    confidence: float = 0.0
    source: str = ""  # alias, identity_map, fuzzy, llm
    matched_name: str = ""
    alternatives: list[AliasMatch] = field(default_factory=list)


class AliasMatcher:
    """Matches school names/aliases against the database.

    Uses PostgreSQL school_alias + school_identity_map tables.
    Accepts either asyncpg.Connection or asyncpg.Pool.
    """

    def __init__(self, pool_or_conn):
        """Initialize with asyncpg connection pool or single connection."""
        self.pool = pool_or_conn
        self._is_conn = hasattr(pool_or_conn, 'fetchrow') and not hasattr(pool_or_conn, 'acquire')

    async def _fetchrow(self, query, *args):
        """Execute fetchrow on pool or connection."""
        if self._is_conn:
            return await self.pool.fetchrow(query, *args)
        else:
            async with self.pool.acquire() as conn:
                return await conn.fetchrow(query, *args)

    async def _fetch(self, query, *args):
        """Execute fetch on pool or connection."""
        if self._is_conn:
            return await self.pool.fetch(query, *args)
        else:
            async with self.pool.acquire() as conn:
                return await conn.fetch(query, *args)

    async def match_exact(self, text: str) -> AliasMatch | None:
        """Exact alias match (confidence 1.0).

        Phase 10.1.7-E: Now considers alias confidence + locale.
        """
        normalized = normalize_for_matching(text)
        if not normalized:
            return None

        # Try exact alias match (normalized) — Phase 10.1.7-E: use confidence from DB
        row = await self._fetchrow(
            """
            SELECT school_id, alias, alias_normalized, source, locale, confidence
            FROM memory.school_alias
            WHERE alias_normalized = $1
            ORDER BY confidence DESC, id ASC
            LIMIT 1
            """,
            normalized,
        )
        if row:
            # Use DB confidence if available, else default 1.0
            conf = row["confidence"] if row["confidence"] else 1.0
            return AliasMatch(
                school_id=row["school_id"],
                alias=row["alias"],
                alias_normalized=row["alias_normalized"],
                source=row["source"],
                confidence=conf,
                locale=row.get("locale", "en"),
            )

        # Try identity map (official names)
        row = await self._fetchrow(
            """
            SELECT school_id, name, normalized_name, source
            FROM memory.school_identity_map
            WHERE normalized_name = $1
            LIMIT 1
            """,
            normalized,
        )
        if row:
            return AliasMatch(
                school_id=row["school_id"],
                alias=row["name"],
                alias_normalized=row["normalized_name"],
                source=row["source"],
                confidence=0.95,
                locale="en",  # identity map defaults to English
            )

        return None

    async def match_fuzzy(self, text: str, threshold: float = 0.7) -> list[AliasMatch]:
        """Fuzzy match using similarity (for typos and partial matches).

        Returns list of matches above threshold, sorted by confidence desc.
        """
        normalized = normalize_for_matching(text)
        if not normalized:
            return []

        # Use pg_trgm similarity for fuzzy matching
        rows = await self._fetch(
            """
            SELECT school_id, alias, alias_normalized, source,
                   similarity(alias_normalized, $1) AS sim
            FROM memory.school_alias
            WHERE alias_normalized % $1  -- trigram similarity operator
            ORDER BY sim DESC
            LIMIT 5
            """,
            normalized,
        )

        matches = []
        for row in rows:
            sim = row["sim"]
            if sim >= threshold:
                matches.append(AliasMatch(
                    school_id=row["school_id"],
                    alias=row["alias"],
                    alias_normalized=row["alias_normalized"],
                    source=row["source"],
                    confidence=sim * 0.75,  # Fuzzy max confidence = 0.75
                ))

        return matches

    async def resolve(self, text: str, min_confidence: float = 0.8) -> EntityResolution:
        """Full resolution pipeline for a single entity.

        Pipeline: Exact alias → Identity map → Fuzzy fallback
        Returns EntityResolution with confidence and alternatives.
        """
        resolution = EntityResolution(query_text=text)

        # Stage 1: Exact alias match (confidence 1.0)
        match = await self.match_exact(text)
        if match and match.confidence >= min_confidence:
            resolution.school_id = match.school_id
            resolution.confidence = match.confidence
            resolution.source = "alias" if match.confidence == 1.0 else "identity_map"
            resolution.matched_name = match.alias
            return resolution

        # Stage 2: Fuzzy match (confidence 0.75 max)
        fuzzy_matches = await self.match_fuzzy(text, threshold=0.6)
        if fuzzy_matches:
            best = fuzzy_matches[0]
            if best.confidence >= min_confidence:
                resolution.school_id = best.school_id
                resolution.confidence = best.confidence
                resolution.source = "fuzzy"
                resolution.matched_name = best.alias
                resolution.alternatives = fuzzy_matches[1:]
                return resolution
            else:
                # Below threshold — store alternatives but don't commit
                resolution.alternatives = fuzzy_matches
                resolution.confidence = best.confidence
                resolution.source = "fuzzy_below_threshold"

        return resolution

    async def resolve_multiple(self, texts: list[str], min_confidence: float = 0.8) -> list[EntityResolution]:
        """Resolve multiple entities (for comparison mode)."""
        results = []
        for text in texts:
            result = await self.resolve(text, min_confidence)
            results.append(result)
        return results

    async def get_chinese_name(self, school_id: str) -> str | None:
        """Get Chinese name for a school from alias or identity map.

        Priority:
            1. Chinese alias in school_alias (locale='zh-TW' or alias contains CJK)
            2. Chinese identity in school_identity_map (language='zh')
            3. None if no Chinese name found
        """
        # Try alias table with locale='zh-TW' (Phase 10.1.7-D upgrade)
        row = await self._fetchrow(
            """
            SELECT alias FROM memory.school_alias
            WHERE school_id = $1 AND locale = 'zh-TW'
            ORDER BY confidence DESC, id ASC
            LIMIT 1
            """,
            school_id,
        )
        if row:
            return row["alias"]

        # Fallback: any CJK alias (pre-10.1.7-D data)
        row = await self._fetchrow(
            """
            SELECT alias FROM memory.school_alias
            WHERE school_id = $1 AND alias ~ '[一-鿿]'
            ORDER BY id ASC
            LIMIT 1
            """,
            school_id,
        )
        if row:
            return row["alias"]

        # Try identity map with language='zh'
        row = await self._fetchrow(
            """
            SELECT name FROM memory.school_identity_map
            WHERE school_id = $1 AND language = 'zh'
            LIMIT 1
            """,
            school_id,
        )
        if row:
            return row["name"]

        return None

    async def get_school_alias_map(self, school_ids: list[str]) -> dict:
        """Get alias map for multiple schools.

        Returns:
            Dict of {school_id: {locale: name}}
        """
        if not school_ids:
            return {}

        rows = await self._fetch(
            """
            SELECT school_id, alias as name, locale
            FROM memory.school_alias
            WHERE school_id = ANY($1)
            ORDER BY confidence DESC, id ASC
            """,
            school_ids,
        )

        alias_map: dict[str, dict[str, str]] = {}
        for row in rows:
            sid = row["school_id"]
            locale = row["locale"]
            if sid not in alias_map:
                alias_map[sid] = {}
            # Only keep highest confidence per locale
            if locale not in alias_map[sid]:
                alias_map[sid][locale] = row["name"]

        return alias_map
