# Education Engine v1.0.0 — Release Lock

**Release Date**: 2026-07-27
**Phase**: Phase 10.1.9 Freeze
**Status**: FROZEN — No breaking changes without version bump

---

## Version Lock

This release locks the Education Engine contract for production use and domain expansion reference.

### Frozen Contracts

| Contract | Version | File | Status |
|----------|---------|------|--------|
| Decision Object | v1.0 | `core/skills/education/presentation/contract.py` | FROZEN |
| Ranking Formula | v1.0 | `core/skills/education/data/ranking_contract_v1.json` | FROZEN |
| Trace Steps | v1.0 | `core/skills/education/presentation/trace_steps.py` | FROZEN |
| Error Contract | v1.0 | `core/skills/education/presentation/error_contract.py` | FROZEN |
| Feedback Event | v1.0 | `core/skills/education/presentation/contract.py` (FeedbackEvent) | FROZEN |

### Schema Version

| Schema | Version | Migration |
|--------|---------|-----------|
| school_alias | v10.1.7-d | `ingestion/migration_v10.1.7-d.sql` |
| recommendation_feedback | v10.1.7-d | `ingestion/migration_v10.1.7-d.sql` |
| FK constraints (trace linkage) | v10.1.9 | `ingestion/migration_v10.1.9_freeze.sql` |

### Golden Tests

| Case | Input | Expected |
|------|-------|----------|
| 1. Entity Resolution | 比較英皇書院和喇沙書院 | SCH-00402, SCH-00166 |
| 2. Constraint Extraction | 九龍城男校推薦 | district=Kowloon City, gender=boys |
| 3. Memory Isolation | reject DBS → 推薦男校 | DBS excluded |
| 4. English Locale | Compare King's College and La Salle | locale=en |
| 5. Mixed CJK Priority | Compare 英皇書院 and La Salle | locale=zh-TW |
| 6. Feedback Parsing | 呢間太遠 | rejected, too_far |
| 7. No Results | 火星中學推薦 | ENTITY_NOT_FOUND |
| 8. Trace Linkage | 九龍城英文中學推薦 | has trace_id |

---

## Ranking Contract v1.0 — Change Log

**IMPORTANT**: This ranking formula replaces the previous experimental scoring model.

### Previous Experimental Model (Phase 10.1.6, pre-freeze)
```
total = constraint * 0.5 + child_fit * 0.3 + evidence * 0.2
```
- `child_fit` was a black-box score combining academic + preference
- Not explainable, not decomposable

### Current Frozen Model (v1.0, Phase 10.1.9)
```
total = constraint * 0.5 + academic_signal * 0.25 + preference_match * 0.15 + evidence * 0.10
```

| Component | Weight | Description | Explainable |
|-----------|--------|-------------|-------------|
| constraint | 0.50 | District, fee, language hard constraints | ✅ |
| academic_signal | 0.25 | Academic signal match (v2 schema) | ✅ |
| preference_match | 0.15 | Child profile + facility fit | ✅ |
| evidence | 0.10 | Evidence diversity + count | ✅ |

**Rationale**: Decomposability. Each component can be traced and explained to parents.
**Impact**: Old trace data (pre-v1.0) may have different scores. Do not compare across versions.

---

## Operational Gates

| Gate | Status | Verification |
|------|--------|--------------|
| Gate 1: Migration Idempotent | ✅ | Run migration twice — no failure |
| Gate 2: Golden Test CI | ✅ | `pytest tests/golden/ -v` — 8 pass |
| Gate 3: Ranking Contract Frozen | ✅ | `ranking_contract_v1.json` immutable |
| Gate 4: Decision Object Backward Compat | ✅ | v1.0 fields frozen, add-only |
| Gate 5: Recovery Drill | ✅ | `bash scripts/recovery_drill.sh` |

---

## File Manifest (v1.0.0)

```
hermes-deploy/
├── core/skills/education/
│   ├── data/
│   │   ├── ranking_contract_v1.json     # Frozen ranking weights
│   │   ├── ranking_contract.py          # Contract loader
│   │   ├── ranking_config.py            # Preset configs (balanced, academic_first, practical, evidence_heavy)
│   │   └── evidence_tracer.py           # Evidence chain builder
│   ├── presentation/
│   │   ├── contract.py                  # Decision Object (v1.0) + FeedbackEvent
│   │   ├── trace_steps.py               # TraceStep enum (8 steps)
│   │   ├── error_contract.py            # Error codes + messages
│   │   ├── locale.py                    # Multi-signal locale resolution
│   │   ├── zh_tw.py / en.py             # Locale labels
│   │   ├── formatter.py                 # Locale-aware formatting
│   │   └── reasoning.py                 # Reasoning from trace
│   ├── entity/
│   │   ├── comparison.py                # Locale-aware output
│   │   └── alias_matcher.py             # Alias confidence + locale
│   └── engine/
│       ├── __init__.py                  # Trace linkage
│       ├── recommendation.py            # Trace ID + constraints
│       ├── feedback_capture.py          # Locale preservation
│       ├── constraint_extractor.py      # Query → constraints
│       ├── matching.py                  # Hard constraint filtering
│       ├── ranking.py                   # Multi-factor scoring
│       └── profile.py                   # Family/child profile builder
├── ingestion/
│   ├── migration_v10.1.7-d.sql          # Locale + alias columns
│   └── migration_v10.1.9_freeze.sql     # FK constraints + indexes
├── tests/golden/
│   └── test_golden_cases.py             # 8 golden test cases
├── scripts/
│   └── recovery_drill.sh                # Backup / recovery drill
└── docs/
    ├── phase_10_1_9_freeze_checklist.md # Complete freeze contract
    ├── golden_test_ci_gate.md           # CI gate documentation
    └── CHANGE_POLICY.md                 # Change policy (see Release Check 3)
```

---

## Future Reference

This v1.0.0 release serves as the **reference implementation** for domain expansion:

- **Commerce Engine**: Copy blueprint, replace `SchoolEntity` → `ProductEntity`
- **Investment Engine**: Copy blueprint, replace `SchoolConstraint` → `RiskConstraint`
- **Personal Assistant Engine**: Copy blueprint, adapt domain adapter

See `docs/hermes_decision_framework_blueprint.md` (Release Check 2) for abstraction.

---

## Signature

```
Education Engine v1.0.0 — FROZEN
Date: 2026-07-27
Phase: Phase 10.1.9
Status: Ready for domain expansion
```
