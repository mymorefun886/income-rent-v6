# Hermes Decision Framework — Architecture Blueprint

**Version**: 1.0.0
**Date**: 2026-07-27
**Source**: Abstracted from Education Engine v1.0.0 (Phase 10.1.9)

---

## Purpose

This document abstracts the Education Engine into a **reusable Decision Framework** that can be applied to any domain:

- **Education** (current): School recommendation for Hong Kong parents
- **Commerce** (future): Product purchase decisions
- **Investment** (future): Asset allocation decisions
- **Personal Assistant** (future): Life decision support

The framework ensures **consistent decision intelligence** across all domains while allowing domain-specific adapters.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Query                               │
│                    "九龍城男校推薦"                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. Intent Intelligence                        │
│                    Domain Router + Intent Classifier             │
│                    Output: intent = "recommendation"             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. Entity Resolution                          │
│                    Entity Resolver (alias → canonical ID)        │
│                    Output: [SCH-00402, SCH-00166]                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. Constraint Extraction                      │
│                    Query → Structured Constraints                │
│                    Output: {district: "Kowloon City",           │
│                             gender: "boys_only"}                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. Candidate Retrieval                        │
│                    Knowledge Base (Qdrant) + Filters             │
│                    Output: [school_1, school_2, ...]             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    5. Hard Constraint Filtering                  │
│                    Match candidates against constraints          │
│                    Output: [eligible_school_1, ...]              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    6. Ranking Engine                             │
│                    Multi-factor scoring (frozen weights)         │
│                    Output: [{school, score, breakdown}, ...]     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    7. Decision Trace                             │
│                    Evidence chain + reasoning generation         │
│                    Output: trace_id, reasoning_trace[]           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    8. Reasoning Generation                       │
│                    Trace → Parent-friendly reasoning             │
│                    Output: ["✓ 符合地區：九龍城", ...]           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    9. Presentation Layer                         │
│                    Locale-aware formatting (zh-TW / en)          │
│                    Output: formatted text + Decision Object      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    10. Decision Object (Response Contract)       │
│                    {schema_version, intent, entities, trace_id}  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    11. Parent Feedback                           │
│                    Feedback capture + locale preservation        │
│                    Output: FeedbackEvent                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    12. Preference Memory                         │
│                    Long-term preference accumulation             │
│                    Output: updated preference_memory              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components (Abstract)

### 1. Domain Adapter (Interface)

Each domain implements this interface:

```python
class DomainAdapter:
    """Abstract interface for domain-specific logic."""

    def resolve_entities(self, query: str) -> list[EntityRef]:
        """Resolve entity names/aliases to canonical IDs."""
        ...

    def extract_constraints(self, query: str) -> Constraints:
        """Extract structured constraints from query."""
        ...

    def retrieve_candidates(self, constraints: Constraints) -> list[Candidate]:
        """Fetch candidates from knowledge base."""
        ...

    def build_reasoning(self, trace: Trace, locale: str) -> list[str]:
        """Generate human-readable reasoning from trace."""
        ...

    def format_output(self, decision: DecisionObject, locale: str) -> str:
        """Format Decision Object for presentation."""
        ...
```

### 2. Entity Resolver (Abstract)

```python
class EntityResolver:
    """Resolve entity references (names, aliases, abbreviations)."""

    def resolve(self, name: str) -> EntityRef:
        """
        Input: "英皇書院" or "King's College" or "K.C."
        Output: EntityRef(id="SCH-00402", name="英皇書院", confidence=1.0)
        """
        ...

    def get_confidence(self) -> float:
        """Resolution confidence (1.0=exact, 0.95=alias, 0.8=short)."""
        ...
```

### 3. Constraint Engine (Abstract)

```python
class ConstraintEngine:
    """Extract structured constraints from natural language query."""

    def extract(self, query: str) -> Constraints:
        """
        Input: "九龍城男校推薦"
        Output: Constraints(districts=["Kowloon City"], gender="boys_only")
        """
        ...

    def validate(self, candidate: Candidate, constraints: Constraints) -> bool:
        """Check if candidate satisfies hard constraints."""
        ...
```

### 4. Ranking Engine (Abstract)

```python
class RankingEngine:
    """Multi-factor scoring with frozen weights."""

    def rank(self, candidates: list[Candidate], context: Context) -> list[ScoredCandidate]:
        """
        Scoring formula (FROZEN v1.0):
        total = constraint * 0.5 + academic_signal * 0.25 + preference_match * 0.15 + evidence * 0.10
        """
        ...

    def explain(self, scored: ScoredCandidate) -> dict:
        """Return component scores for transparency."""
        ...
```

### 5. Decision Trace (Abstract)

```python
class DecisionTrace:
    """Evidence chain for auditability."""

    def build(self, candidate: Candidate, scores: dict) -> Trace:
        """Build evidence chain from candidate data + scores."""
        ...

    def get_reasoning(self, trace: Trace, locale: str) -> list[str]:
        """Generate reasoning statements from trace."""
        ...
```

### 6. Decision Object (Response Contract)

```python
@dataclass
class DecisionObject:
    """Frozen v1.0 — DO NOT MODIFY without version bump."""
    schema_version: str = "1.0"
    intent: str = ""
    entities: list = field(default_factory=list)
    locale: LocaleContext = field(default_factory=LocaleContext)
    presentation: dict = field(default_factory=dict)
    trace_id: str = ""  # REQUIRED
    user_id: str = ""
    query: str = ""
```

### 7. Feedback Memory (Abstract)

```python
class FeedbackMemory:
    """Long-term preference accumulation."""

    def capture(self, event: FeedbackEvent) -> None:
        """Store feedback event."""
        ...

    def get_preferences(self, user_id: str) -> Preferences:
        """Retrieve accumulated preferences."""
        ...

    def apply_to_context(self, preferences: Preferences, context: Context) -> Context:
        """Adjust context based on preferences (NOT ranking weights)."""
        ...
```

---

## Domain Implementations

### Education Domain (Current)

```python
class EducationAdapter(DomainAdapter):
    """Hong Kong secondary school recommendation."""

    def resolve_entities(self, query: str) -> list[EntityRef]:
        # Use school_alias table (locale-aware)
        return SchoolAliasMatcher().match(query)

    def extract_constraints(self, query: str) -> Constraints:
        # Extract district, gender, school_type, language, interests
        return ConstraintExtractor().extract(query)

    def retrieve_candidates(self, constraints: Constraints) -> list[Candidate]:
        # Query Qdrant with payload filters
        return KnowledgeSearch().search("education", constraints)

    def build_reasoning(self, trace: Trace, locale: str) -> list[str]:
        # Generate parent-friendly reasoning
        return ReasoningGenerator().generate(trace, locale)

    def format_output(self, decision: DecisionObject, locale: str) -> str:
        # Use zh_tw.py or en.py labels
        return Formatter().format(decision, locale)
```

**Domain-Specific Files**:
- `entity/school_alias.py` — School alias matching
- `engine/constraint_extractor.py` — HK school constraints (district, gender, etc.)
- `data/ranking_contract_v1.json` — Frozen weights
- `presentation/zh_tw.py` / `en.py` — Locale labels

### Commerce Domain (Future)

```python
class CommerceAdapter(DomainAdapter):
    """Product purchase decisions."""

    def resolve_entities(self, query: str) -> list[EntityRef]:
        # Product name → product_id
        return ProductCatalog().resolve(query)

    def extract_constraints(self, query: str) -> Constraints:
        # Extract price_range, brand, features, use_case
        return ProductConstraintExtractor().extract(query)

    def retrieve_candidates(self, constraints: Constraints) -> list[Candidate]:
        # Query product vector DB
        return ProductSearch().search(constraints)

    def build_reasoning(self, trace: Trace, locale: str) -> list[str]:
        # Generate purchase reasoning
        return ProductReasoning().generate(trace, locale)

    def format_output(self, decision: DecisionObject, locale: str) -> str:
        # Format product comparison
        return ProductFormatter().format(decision, locale)
```

**Domain-Specific Files** (future):
- `entity/product_catalog.py` — Product name resolution
- `engine/product_constraint_extractor.py` — Price, brand, features
- `data/ranking_contract_v1.json` — May have different weights (new version)
- `presentation/product_formatter.py` — Product comparison format

### Investment Domain (Future)

```python
class InvestmentAdapter(DomainAdapter):
    """Asset allocation decisions."""

    def resolve_entities(self, query: str) -> list[EntityRef]:
        # Asset name → ticker
        return AssetResolver().resolve(query)

    def extract_constraints(self, query: str) -> Constraints:
        # Extract risk_tolerance, time_horizon, amount, goals
        return RiskConstraintExtractor().extract(query)

    def retrieve_candidates(self, constraints: Constraints) -> list[Candidate]:
        # Query asset vector DB
        return AssetSearch().search(constraints)

    def build_reasoning(self, trace: Trace, locale: str) -> list[str]:
        # Generate investment reasoning
        return InvestmentReasoning().generate(trace, locale)

    def format_output(self, decision: DecisionObject, locale: str) -> str:
        # Format portfolio recommendation
        return PortfolioFormatter().format(decision, locale)
```

---

## Shared Infrastructure (Not Domain-Specific)

These components are **shared** across all domains:

| Component | File | Purpose |
|-----------|------|---------|
| Decision Object | `presentation/contract.py` | Response contract (frozen) |
| TraceStep enum | `presentation/trace_steps.py` | 8 fixed pipeline steps |
| Error Contract | `presentation/error_contract.py` | Standardized error codes |
| Locale resolution | `presentation/locale.py` | Multi-signal locale detection |
| Gateway | `gateway/` | Message routing |
| Memory API | `memory/` | Preference persistence |
| Qdrant | `qdrant/` | Vector search |
| Knowledge | `knowledge/` | Domain knowledge base |

---

## Data Flow (Cross-Domain)

```
                    ┌──────────────────┐
                    │   User Query     │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Gateway Router  │  ← Shared
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───┐  ┌──────▼─────┐  ┌────▼────────┐
     │ Education  │  │  Commerce  │  │ Investment  │
     │  Adapter   │  │  Adapter   │  │  Adapter    │
     └────────┬───┘  └──────┬─────┘  └────┬────────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼─────────┐
                    │  Decision Object │  ← Shared (frozen)
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Feedback Memory │  ← Shared
                    └──────────────────┘
```

---

## Contract Freeze Rules

### Frozen (Cannot Modify Without Version Bump)
- Decision Object schema (v1.0 fields)
- TraceStep enum (8 steps)
- Error codes (6 codes)
- Ranking formula weights (v1.0)
- Migration idempotency pattern

### Allowed (Can Add)
- New domain adapters (Commerce, Investment, etc.)
- New entity fields (add-only)
- New evidence sources
- New locales
- New feedback types

### Forbidden
- Removing Decision Object fields
- Renaming TraceStep enum values
- Mutating ranking weights via feedback
- Breaking backward compatibility

---

## Expansion Checklist

When adding a new domain (e.g., Commerce):

- [ ] Create `DomainAdapter` implementation
- [ ] Implement `EntityResolver` for domain entities
- [ ] Implement `ConstraintEngine` for domain constraints
- [ ] Define domain-specific ranking weights (may differ from Education)
- [ ] Create locale labels (zh-TW / en) for domain
- [ ] Add golden test cases (minimum 8)
- [ ] Run existing Education golden tests (must still pass)
- [ ] Document domain-specific reasoning patterns
- [ ] Update `ranking_contract_v1.json` if weights differ (version bump)

---

## Summary

**Hermes Decision Framework** is a reusable AI Decision Engine blueprint.

- **Education** is the first domain adapter (v1.0.0, frozen)
- **Commerce / Investment / Personal Assistant** will follow
- **Decision Object** is the shared response contract
- **Ranking weights** are frozen per-domain (versioned)
- **Feedback** affects preference memory, NOT ranking weights
- **Golden tests** protect against regressions

**Next Step**: After Education v1.0.0 freeze, implement Commerce adapter to validate framework abstraction.
