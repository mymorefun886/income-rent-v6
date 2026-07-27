# Phase 10.1.9 — Education Engine v1.0 Freeze Checklist

## Purpose

Freeze the Education Engine API contract before expanding to Commerce / Investment / Personal Assistant domains.

This ensures:
- Decision Object schema is stable
- Trace linkage is mandatory
- Locale system is complete
- Feedback contract is fixed
- Error handling is standardized
- Golden test suite passes
- **Operational gates are enforced (Phase 10.1.9 enhancement)**

---

## Phase 10.1.9 Operational Gates (NEW)

Before freeze is declared, these 5 gates MUST be satisfied:

### Gate 1: Schema Migration Safety — IDEMPOTENT

**Status**: ✅ Implemented

**Rule**: All migrations MUST be safe to run multiple times.

**Requirements**:
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (not just `ADD COLUMN`)
- `CREATE INDEX IF NOT EXISTS` (not just `CREATE INDEX`)
- `ADD CONSTRAINT` wrapped in `DO $$ BEGIN IF NOT EXISTS ... END$$` block
- `UPDATE` operations must be idempotent (safe to re-run)

**Files**:
- `ingestion/migration_v10.1.7-d.sql` — all `ADD COLUMN IF NOT EXISTS`
- `ingestion/migration_v10.1.9_freeze.sql` — all constraints use `DO $$ IF NOT EXISTS` pattern

**Verification**:
```bash
# Run migration twice — should succeed both times
psql -U hermes -d hermes -f migration_v10.1.7-d.sql
psql -U hermes -d hermes -f migration_v10.1.7-d.sql  # Second run must not fail
```

---

### Gate 2: Golden Test CI Gate — MANDATORY

**Status**: ✅ Documented

**Rule**: Any modification to Education Engine code requires golden test pass.

**Affected Directories**:
```
core/skills/education/entity/
core/skills/education/engine/
core/skills/education/presentation/
core/skills/education/data/ranking*.py
```

**How to Run**:
```bash
cd hermes-deploy
python -m pytest tests/golden/ -v
```

**Expected**: All 8 golden cases pass.

**Documentation**: `docs/golden_test_ci_gate.md`

**Future**: Pre-commit hook + CI pipeline enforcement.

---

### Gate 3: Ranking Contract Freeze — IMMUTABLE

**Status**: ✅ Implemented

**Rule**: Ranking weights are FROZEN. Feedback MUST NOT mutate weights.

**Contract File**: `core/skills/education/data/ranking_contract_v1.json`

**Frozen Weights (v1.0)**:
```json
{
  "constraint": 0.5,
  "academic_signal": 0.25,
  "preference_match": 0.15,
  "evidence": 0.10
}
```

**Immutable Rule**:
- ✅ Correct: Feedback → Preference Memory → Context Adjustment
- ❌ Forbidden: Feedback → Ranking Weight Mutation

**Phase 11 Note**: Learning may adjust constraint extraction, NOT these weights.

**Loader Module**: `core/skills/education/data/ranking_contract.py`

---

### Gate 4: Decision Object Backward Compatibility — ADD-ONLY

**Status**: ✅ Documented

**Rule**: v1.0 fields are FROZEN. New versions may ADD fields only.

**Compatibility Rules**:
1. New fields OK (forward-compatible)
2. Existing fields CANNOT be removed or renamed
3. Field types should not change
4. Breaking changes require schema_version bump (v2.0)
5. Gateway / Telegram / Dashboard must handle missing new fields gracefully

**v1.0 Frozen Fields**:
- `schema_version`, `intent`, `entities`, `locale`, `presentation`, `trace_id`, `user_id`, `query`

**v1.1+ May ADD**:
- `confidence`, `alternatives`, `risk`, `parent_action`, `outcome_tracking`

**Documentation**: `core/skills/education/presentation/contract.py` (docstring)

---

### Gate 5: Backup / Recovery Drill — REPRODUCIBLE

**Status**: ✅ Script created

**Rule**: System must produce identical results after restore (reproducibility).

**Script**: `scripts/recovery_drill.sh`

**Drill Flow**:
1. Run golden query → capture Decision Object (trace_id, scores)
2. Backup PostgreSQL + Qdrant
3. (Simulated) Drop test data
4. Restore from backup
5. Re-run golden query → compare Decision Object

**Expected**: Same query produces same top-3 schools with same scores.

**Usage**:
```bash
bash scripts/recovery_drill.sh
```

---

## A. Decision Object Contract (FREEZE)

### Schema Version: 1.0

```json
{
  "schema_version": "1.0",
  "intent": "school_comparison | recommendation",
  "entities": [
    {
      "type": "school",
      "id": "SCH-00402",
      "name": "英皇書院",
      "name_en": "King's College",
      "name_tc": "英皇書院",
      "confidence": 1.0,
      "total_score": 0.85,
      "component_scores": {
        "constraint": 0.9,
        "academic": 0.7,
        "preference": 0.6,
        "evidence_quality": 0.8
      },
      "constraint_match": {
        "district": true,
        "gender": true,
        "school_type": false
      },
      "academic_match": {
        "science": 0.4,
        "language_strength": 0.3
      },
      "reasoning_trace": [
        "✓ 符合地區：中西區",
        "✓ 符合性別：男校",
        "✓ 科學發展能力：高"
      ]
    }
  ],
  "locale": {
    "resolved": "zh-TW",
    "source": "query_detection | user_pference | telegram | default"
  },
  "trace_id": "rec-sess-uuid-xxx",
  "query": "比較英皇書院和喇沙書院"
}
```

### Freeze Rules:
- `schema_version` is REQUIRED (forward compatibility)
- `trace_id` is REQUIRED (links to `memory.recommendation_session.id`)
- `entities` array is REQUIRED (empty if no results)
- `locale.resolved` is REQUIRED
- Entity reference includes: type, id, name, name_en, name_tc, confidence

---

## B. Trace Linkage Contract (FREEZE)

### Database Relationship (Phase 10.1.9)

```
recommendation_session (parent)
    ├── recommendation_result (child) — 1:N
    ├── recommendation_trace (child) — 1:N
    └── recommendation_feedback (child) — 1:N
```

### FK Constraints

```sql
-- Result → Session
ALTER TABLE memory.recommendation_result
ADD CONSTRAINT fk_result_session
FOREIGN KEY (session_id) REFERENCES memory.recommendation_session(id);

-- Trace → Session
ALTER TABLE memory.recommendation_trace
ADD CONSTRAINT fk_trace_session
FOREIGN KEY (session_id) REFERENCES memory.recommendation_session(id);

-- Feedback → Session
ALTER TABLE memory.recommendation_feedback
ADD CONSTRAINT fk_feedback_session
FOREIGN KEY (session_id) REFERENCES memory.recommendation_session(id);
```

### Rule: Feedback is a RESULT, not a trace owner

✅ Correct: Feedback → Session → Trace
❌ Wrong: Feedback → Trace

---

## C. Locale Contract (FREEZE)

### Supported Locales

| Locale | Description | Default For |
|--------|-------------|-------------|
| zh-TW | Traditional Chinese | Hong Kong parents |
| en | English | International parents |

### Resolution Priority

1. User preference memory (`preference_memory.preference_type = "locale"`)
2. Telegram language (`telegram_language_code`)
3. Query language detection (CJK regex)
4. Default: `zh-TW`

### Storage

- `recommendation_session.locale` — locale used for this decision
- `recommendation_feedback.locale` — locale of feedback text

---

## D. Feedback Contract (FREEZE)

### Feedback Types

| Type | Description | Phase |
|------|-------------|-------|
| accepted | Parent likes this school | 10.2.1 |
| rejected | Parent rejects this school | 10.2.1 |
| shortlisted | Parent saves for later | 10.2.1 |
| considering | Parent is considering | 10.2.2 |
| visited | Parent visited open day | 10.2.2 |
| enrolled | Child enrolled | 10.2.2 |

### Rejection Reasons

| Reason | Description |
|--------|-------------|
| too_far | Distance/transport issue |
| tuition | Fee too expensive |
| academic_fit | Academic level mismatch |
| school_culture | Culture/religion mismatch |
| child_preference | Child doesn't want it |
| other | Other reason |

### Feedback Event Schema

```json
{
  "user_id": "parent-001",
  "school_id": "SCH-00402",
  "feedback_type": "rejected",
  "reason": "too_far",
  "comment": "呢間太遠",
  "locale": "zh-TW",
  "confidence": 0.95
}
```

---

## E. Error Contract (FREEZE)

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| ENTITY_NOT_FOUND | School name not recognized | 200 (with suggestions) |
| NO_RESULTS | No schools match constraints | 200 (empty entities) |
| INVALID_QUERY | Cannot parse query | 400 |
| TRACE_FAILED | Trace persistence failed | 500 |
| LOCALE_DETECTION_FAILED | Locale detection failed | 200 (fallback) |
| KNOWLEDGE_UNAVAILABLE | Knowledge base unavailable | 503 |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ENTITY_NOT_FOUND",
    "message": "找不到指定的學校名稱，請確認後重新查詢",
    "locale": "zh-TW",
    "details": {
      "entity": "火星中學"
    }
  }
}
```

### Rule: All errors use same format

✅ Correct: `{"success": false, "error": {"code": "...", "message": "..."}}`
❌ Wrong: `{"error": "..."}` or `{"message": "..."}`

---

## F. Trace Step Enum (FREEZE)

### Fixed Pipeline Steps

```python
class TraceStep(str, Enum):
    INTENT_DETECTION = "intent_detection"
    ENTITY_RESOLUTION = "entity_resolution"
    CONSTRAINT_EXTRACTION = "constraint_extraction"
    CANDIDATE_RETRIEVAL = "candidate_retrieval"
    CONSTRAINT_FILTERING = "constraint_filtering"
    RANKING = "ranking"
    REASONING_GENERATION = "reasoning_generation"
    PRESENTATION = "presentation"
```

### Freeze Rules:
- Order matters (pipeline sequence)
- Names are API contract (don't rename without version bump)
- New steps can be added but existing ones cannot be removed

### Analytics Categories (Phase 11)

| Step | Failure Description |
|------|---------------------|
| entity_resolution | Entity cannot be resolved from query |
| constraint_extraction | Cannot extract valid constraints |
| candidate_retrieval | No candidates found in knowledge base |
| constraint_filtering | All candidates filtered out by hard constraints |
| ranking | Ranking produced no viable results |

---

## G. API Endpoints (FREEZE)

### Current Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /core/process | Main query endpoint |
| POST | /education/feedback | Submit feedback |
| GET | /education/preferences/{user_id} | Get preferences |
| GET | /gateway/education/preferences/{user_id} | Gateway proxy |

### Response Contract

All responses include:
```json
{
  "intent": "...",
  "confidence": 0.95,
  "domain": "education",
  "skill": "education_recommendation",
  "response": "formatted text",
  "trace_id": "session-uuid",
  "elapsed_ms": 1234.5
}
```

---

## H. Golden Test Suite (FREEZE)

### Test Cases (8 cases)

| Case | Name | Input | Expected |
|------|------|-------|----------|
| 1 | Entity Resolution | 比較英皇書院和喇沙書院 | SCH-00402, SCH-00166 |
| 2 | Constraint Extraction | 九龍城男校推薦 | district=Kowloon City, gender=boys |
| 3 | Memory Isolation | reject DBS → 推薦男校 | DBS excluded |
| 4 | English Locale | Compare King's College and La Salle | locale=en |
| 5 | Mixed CJK Priority | Compare 英皇書院 and La Salle | locale=zh-TW |
| 6 | Feedback Parsing | 呢間太遠 | rejected, too_far |
| 7 | No Results | 火星中學推薦 | ENTITY_NOT_FOUND |
| 8 | Trace Linkage | 九龍城英文中學推薦 | has trace_id |

### Run Tests

```bash
cd hermes-deploy
python -m pytest tests/golden/ -v
```

---

## I. Freeze Validation Gates

### Gate 1: Decision Object Schema
- [ ] All responses include `schema_version: "1.0"`
- [ ] All responses include `trace_id`
- [ ] `entities` array is never null
- [ ] Entity reference includes type, id, name, confidence

### Gate 2: Trace Linkage
- [ ] Every recommendation creates a `recommendation_session` row
- [ ] Every feedback references a valid `session_id`
- [ ] FK constraints are applied
- [ ] Trace can be retrieved by `trace_id`

### Gate 3: Locale
- [ ] Chinese query → Chinese response
- [ ] English query → English response
- [ ] Mixed query → CJK priority
- [ ] User preference overrides query detection

### Gate 4: Feedback
- [ ] Feedback preserves locale
- [ ] Feedback updates preference memory
- [ ] Feedback does NOT modify ranking weights

### Gate 5: Error Handling
- [ ] All errors follow error contract (`code` + `message`)
- [ ] No 500 errors for user input issues
- [ ] Graceful degradation when knowledge base is empty

### Gate 6: Golden Test Suite
- [ ] All 8 golden cases pass
- [ ] New golden cases added for any new features
- [ ] Golden cases run in CI/CD pipeline

---

## J. Post-Freeze Roadmap

### Phase 10.2.1 — Gateway Feedback UX
- Telegram buttons: [👍 喜歡] [👎 不考慮] [📌 收藏] [📅 想了解]
- Web UI feedback flow
- Feedback confirmation messages

### Phase 10.2.2 — Feedback Expansion
- Add: considering, visited, enrolled
- Still NO ranking weight modification
- Accumulate decision data for Phase 11

### Phase 11 — Learning Optimization (Future)
- Requires: 1000+ recommendation → feedback cycles
- Analyze: parent choice patterns
- Output: improved constraint extraction (NOT weight tuning)

### Domain Expansion (Future)
- Commerce Decision Engine (same blueprint)
- Investment Decision Engine (same blueprint)
- Personal Assistant Decision Engine (same blueprint)

---

## Summary

**Freeze means:**
- Schema changes require version bump
- API contract is stable
- New features extend, don't modify
- Trace linkage is mandatory
- Golden test suite must pass

**Freeze does NOT mean:**
- No new features
- No bug fixes
- No performance improvements
- No new locales (but existing ones are frozen)

**Version History:**
- v1.0 (Phase 10.1.9): Initial freeze — Decision Object, Trace Linkage, Locale, Feedback, Error, Golden Tests
