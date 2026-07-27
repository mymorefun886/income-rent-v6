# Phase 10.1.9: Golden Test CI Gate

## Purpose

Golden tests MUST pass before any merge/modification to Education Engine code.
This prevents regressions when:
- Adding new features
- Copying blueprint to Commerce / Investment / Personal Assistant
- Refactoring internals

## Rule

**Any modification to these directories requires golden test pass:**
```
core/skills/education/entity/
core/skills/education/engine/
core/skills/education/presentation/
core/skills/education/data/ranking*.py
```

## How to Run

```bash
cd hermes-deploy
python -m pytest tests/golden/ -v
```

## Expected Output

All 8 golden cases must PASS:
1. entity_resolution_basic
2. constraint_extraction_district_gender
3. memory_isolation_rejected_school
4. locale_english
5. locale_mixed_cjk_priority
6. feedback_natural_language
7. no_results_graceful
8. trace_linkage

## CI Integration (Future)

For GitHub Actions / GitLab CI:
```yaml
- name: Golden Test Gate
  run: |
    cd hermes-deploy
    python -m pytest tests/golden/ -v --tb=short
  env:
    HERMES_TEST_MODE: "1"
```

## Adding New Golden Cases

When adding features that affect Decision Object output:
1. Add new case to `tests/golden/test_golden_cases.py`
2. Update `GOLDEN_CASES` list
3. Ensure all existing cases still pass

## Enforcement

- Pre-commit hook (future): run golden tests before commit
- CI pipeline (future): block merge if golden tests fail
- Manual: developer must run before PR
