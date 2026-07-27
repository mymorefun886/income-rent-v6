# Education Engine — Change Policy

**Version**: v1.0.0
**Effective Date**: 2026-07-27
**Phase**: Phase 10.1.9 Freeze

---

## Purpose

This document defines **what can and cannot be changed** in the Education Engine after v1.0.0 freeze.

The goal is to **prevent regression** during future expansion (Commerce, Investment, Personal Assistant) while allowing **safe evolution**.

---

## FROZEN (Cannot Modify Without Version Bump)

These contracts are **immutable**. Any change requires `schema_version` bump (v2.0) and full regression testing.

### 1. Decision Object Schema (v1.0)

| Field | Type | Status |
|-------|------|--------|
| `schema_version` | `str` | FROZEN — always "1.0" for this version |
| `intent` | `str` | FROZEN — "school_comparison" or "recommendation" |
| `entities` | `list` | FROZEN — array, never null |
| `locale` | `LocaleContext` | FROZEN — resolved locale required |
| `presentation` | `dict` | FROZEN — text + format |
| `trace_id` | `str` | FROZEN — links to recommendation_session.id |
| `user_id` | `str` | FROZEN |
| `query` | `str` | FROZEN |

**Rule**: Can ADD fields, CANNOT remove or rename existing fields.

### 2. Ranking Formula Weights (v1.0)

| Component | Weight | Status |
|-----------|--------|--------|
| `constraint` | 0.50 | FROZEN |
| `academic_signal` | 0.25 | FROZEN |
| `preference_match` | 0.15 | FROZEN |
| `evidence` | 0.10 | FROZEN |

**Rule**: These weights are **immutable**. Feedback MUST NOT mutate them.

**Correct flow**: Feedback → Preference Memory → Context Adjustment
**Forbidden flow**: Feedback → Ranking Weight Mutation

**Phase 11 Note**: May adjust constraint extraction, NOT these weights.

### 3. TraceStep Enum (8 Steps)

| Step | Value | Status |
|------|-------|--------|
| 1 | `intent_detection` | FROZEN |
| 2 | `entity_resolution` | FROZEN |
| 3 | `constraint_extraction` | FROZEN |
| 4 | `candidate_retrieval` | FROZEN |
| 5 | `constraint_filtering` | FROZEN |
| 6 | `ranking` | FROZEN |
| 7 | `reasoning_generation` | FROZEN |
| 8 | `presentation` | FROZEN |

**Rule**: Can ADD steps, CANNOT remove or rename existing steps.

### 4. Error Contract (6 Codes)

| Code | HTTP Status | Status |
|------|-------------|--------|
| `ENTITY_NOT_FOUND` | 200 | FROZEN |
| `NO_RESULTS` | 200 | FROZEN |
| `INVALID_QUERY` | 400 | FROZEN |
| `TRACE_FAILED` | 500 | FROZEN |
| `LOCALE_DETECTION_FAILED` | 200 | FROZEN |
| `KNOWLEDGE_UNAVAILABLE` | 503 | FROZEN |

**Error Response Format** (FROZEN):
```json
{
  "success": false,
  "error": {
    "code": "ENTITY_NOT_FOUND",
    "message": "...",
    "locale": "zh-TW"
  }
}
```

### 5. Feedback Event Schema

| Field | Type | Status |
|-------|------|--------|
| `user_id` | `str` | FROZEN |
| `school_id` | `str` | FROZEN |
| `feedback_type` | `str` | FROZEN (see allowed values) |
| `reason` | `Optional[str]` | FROZEN (see allowed values) |
| `comment` | `Optional[str]` | FROZEN |
| `locale` | `str` | FROZEN |

**feedback_type allowed values**: `accepted`, `rejected`, `shortlisted` (Phase 10.2.1), `considering`, `visited`, `enrolled` (Phase 10.2.2)

**reason allowed values**: `too_far`, `tuition`, `academic_fit`, `school_culture`, `child_preference`, `other`

### 6. Database Schema (PostgreSQL)

**FROZEN Tables**:
- `memory.recommendation_session`
- `memory.recommendation_result`
- `memory.recommendation_trace`
- `memory.recommendation_feedback`
- `memory.school_alias` (with locale, alias_type, confidence columns)

**Phase 10.2 FROZEN Tables (v1.2.0)**:
- `memory.school_entity_master` (EDB anchor, bilingual names)
- `memory.school_entity_mapping` (cross-source mapping)
- `memory.school_alias` (bilingual aliases: official/short/common/former, with normalized_alias)
- `memory.school_secondary_network` (with network_year, allocation_phase)
- `memory.school_primary_network` (POA nets)
- `memory.school_relationship` (with confidence_score, effective_year, expiry_year)
- `memory.school_profile_evidence` (with language field)
- `memory.school_availability` (with language field, snapshot_date)
- `memory.school_cost_profile` (time-sensitive fees)
- `memory.decision_evidence` (with decision_id, factor_type)
- `memory.evidence_document` (original PDF/CSV tracking)
- `memory.evidence_chunk` (RAG chunks with embedding_id)

**FROZEN FK Constraints**:
- `fk_result_session` — result → session
- `fk_trace_session` — trace → session
- `fk_feedback_session` — feedback → session

**Rule**: Can ADD columns (IF NOT EXISTS), CANNOT remove columns or FK constraints.
**Phase 10.2 Rule**: Schema is FROZEN at v1.2.0. No new tables or columns without version bump.

### 7. Golden Test Cases (8 Cases)

| # | Name | Input | Expected |
|---|------|-------|----------|
| 1 | Entity Resolution | 比較英皇書院和喇沙書院 | SCH-00402, SCH-00166 |
| 2 | Constraint Extraction | 九龍城男校推薦 | district=Kowloon City, gender=boys |
| 3 | Memory Isolation | reject DBS → 推薦男校 | DBS excluded |
| 4 | English Locale | Compare King's College and La Salle | locale=en |
| 5 | Mixed CJK Priority | Compare 英皇書院 and La Salle | locale=zh-TW |
| 6 | Feedback Parsing | 呢間太遠 | rejected, too_far |
| 7 | No Results | 火星中學推薦 | ENTITY_NOT_FOUND |
| 8 | Trace Linkage | 九龍城英文中學推薦 | has trace_id |

**Rule**: Can ADD cases, CANNOT remove existing cases.

---

## ALLOWED (Can Add/Modify)

These changes are safe and do NOT require version bump.

### 1. New Entity Fields (Add-Only)

Can add new fields to entities (e.g., `school.website`, `school.photo_url`):
- Must be optional (default None or empty)
- Must not break existing API consumers
- Must not affect ranking formula

### 2. New Evidence Sources

Can add new evidence sources (e.g., `school_photo`, `parent_review`):
- Must update `evidence_tracer.py` to handle new source
- Must not change existing source behavior

### 3. New Locales

Can add new locales (e.g., `zh-CN`, `ja`):
- Must create new locale file (e.g., `zh_cn.py`)
- Must not modify existing `zh_tw.py` or `en.py`
- Must update `locale.py` resolution logic

### 4. New Feedback Types (Pre-Defined)

Can implement pre-defined feedback types:
- Phase 10.2.1: `accepted`, `rejected`, `shortlisted`
- Phase 10.2.2: `considering`, `visited`, `enrolled`

Must NOT add new `reason` values without documentation.

### 5. Performance Improvements

Allowed if:
- Decision Object output unchanged
- Golden tests still pass
- No breaking API changes

Examples:
- Query optimization
- Caching (with cache invalidation)
- Index additions

### 6. Bug Fixes

Allowed if:
- Fix brings behavior closer to documented contract
- Golden tests still pass
- No new features added

### 7. Phase 10.2: School Master Registry (Additive)

Allowed additions for EDB integration:
- ✅ New `memory.school_entity_master` table (EDB anchor, bilingual names)
- ✅ New `memory.school_entity_mapping` table (cross-source mapping)
- ✅ New `memory.school_alias` table (bilingual aliases for Entity Resolution: official/short/common/former)
- ✅ New `memory.school_secondary_network` table (Layer 2 — secondary school nets, with network_year)
- ✅ New `memory.school_primary_network` table (Layer 2 — primary school nets)
- ✅ New `memory.school_relationship` table (Layer 3 — through-train, feeder, nominated, affiliated, same_organization, sister_school, with confidence_score)
- ✅ New `memory.school_profile_evidence` table (Layer 4 — SSP/PSP/KGP profiles, with language field)
- ✅ New `memory.school_availability` table (Layer 5 — K1-K3 vacancy, with language field)
- ✅ New `memory.school_cost_profile` table (Layer 6 — cost intelligence, time-sensitive fees)
- ✅ New `memory.decision_evidence` table (Layer 6 — parent cases, recommendation reasoning, with decision_id)
- ✅ New `memory.evidence_document` table (Layer 1c — original PDF/CSV document tracking)
- ✅ New `memory.evidence_chunk` table (Layer 1d — RAG chunks with embedding references)
- ✅ Geo coordinates (`latitude`, `longitude`) in Qdrant payload
- ✅ Website field in Qdrant payload (future crawling source)
- ✅ Per-field evidence provenance (`field_sources` dict in evidence_tracer)
- ✅ Source-aware entity resolution (EDB anchor → identity map → alias → fuzzy + address + district)
- ✅ Bilingual Entity Resolution (multi-stage: school_no → ZH name → EN name → alias → fuzzy)
- ✅ Geo distance scoring folded into `preference_match` (NOT new weight)
- ✅ Entity resolution validation script (Batch 0 — pre-ingestion, with layer-specific match rates)
- ✅ Ambiguous entity handling (clarification flow when multiple matches)
- ✅ Bilingual RAG strategy (multilingual embedding, language field in payload)

Constraints:
- Must NOT change ranking formula weights (still constraint 0.5 / academic 0.25 / preference 0.15 / evidence 0.10)
- Must NOT break existing golden tests
- Must NOT remove or rename existing tables/columns
- Must use idempotent migrations (IF NOT EXISTS)
- Must run entity resolution validation BEFORE profile ingestion
- Must ask clarification when entity is ambiguous (no auto-recommend)
- Must store both ZH and EN versions of evidence (not treat as separate datasets)
- Must use language field (zh-HK / en) to distinguish bilingual content

---

## FORBIDDEN (Never Do)

These actions are **strictly prohibited** without formal version bump process.

### 1. Breaking Schema Changes

- ❌ Remove Decision Object fields
- ❌ Rename Decision Object fields
- ❌ Change field types (e.g., `str` → `int`)
- ❌ Remove FK constraints

### 2. Ranking Weight Mutation

- ❌ Modify `ranking_contract_v1.json` weights
- ❌ Allow feedback to directly change weights
- ❌ Add hidden weight adjustments

### 3. Trace Step Mutation

- ❌ Remove existing TraceStep enum values
- ❌ Rename TraceStep enum values
- ❌ Reorder pipeline steps

### 4. Golden Test Removal

- ❌ Remove existing golden test cases
- ❌ Weaken expected values to make tests pass

### 5. Migration Non-Idempotency

- ❌ Use `ADD COLUMN` without `IF NOT EXISTS`
- ❌ Use `CREATE INDEX` without `IF NOT EXISTS`
- ❌ Use `ADD CONSTRAINT` without existence check

---

## BREAKING CHANGE PROCESS

If a breaking change is unavoidable:

1. **Document the change** in `docs/education_engine_v2.0.0_release.md`
2. **Bump schema_version** from "1.0" to "2.0"
3. **Create migration** (idempotent) for schema changes
4. **Update golden tests** to reflect new contract
5. **Run full regression** — all existing golden tests must pass OR be explicitly deprecated
6. **Update CHANGE_POLICY.md** with new frozen contracts
7. **Notify all domain adapters** (Commerce, Investment) of breaking change

**Rule**: Breaking changes should be rare (ideally once per year).

---

## Version History

| Version | Date | Phase | Changes |
|---------|------|-------|---------|
| v1.0.0 | 2026-07-27 | Phase 10.1.9 | Initial freeze — Decision Object, Ranking, Trace, Error, Feedback, Golden Tests |
| v1.1.0 | 2026-07-27 | Phase 10.2 | Additive: EDB Master Registry, geo intelligence, per-field evidence provenance. No breaking changes. |
| v1.1.1 | 2026-07-27 | Phase 10.2 (Refined) | Architectural review refinements: rename sspa_serving → secondary_network, expand relationship types, move cost to Layer 6, add decision_evidence, add entity resolution validation. No breaking changes. |
| v1.1.2 | 2026-07-27 | Phase 10.2 (Final) | Final refinements: add network_year to secondary_network, add confidence_score to relationships, add address matching to entity resolution, add layer-specific match rates, add ambiguous entity handling test case, refine decision_evidence with decision_id. No breaking changes. |
| v1.2.0 | 2026-07-27 | Phase 10.2 (Freeze) | **ARCHITECTURE FREEZE**. Bilingual support: add school_alias table (with normalized_alias), add language field to evidence tables, add evidence_document + evidence_chunk for RAG document management, upgrade Entity Resolution Validator to multi-stage bilingual matching. No breaking changes. |

---

## Summary

| Category | Action | Approval Required |
|----------|--------|-------------------|
| FROZEN contracts | Modify | Version bump (v2.0) + full regression |
| ALLOWED additions | Add entity fields, evidence, locales, feedback types | Golden test pass |
| FORBIDDEN actions | Break schema, mutate weights, remove tests | Never (without version bump) |

---

## Signature

```
Education Engine Change Policy — v1.0.0 FROZEN
Date: 2026-07-27
Phase: Phase 10.1.9
Status: Active
```
