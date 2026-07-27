# Phase 10.3 — Operational Metrics

**Status**: Active
**Phase**: Phase 10.3 — Education Intelligence Runtime Validation
**Purpose**: Define measurable quality metrics for Entity Resolution, Evidence Retrieval, and Decision Explanation

---

## Purpose

Phase 10.2 built the **data foundation**. Phase 10.3 validates that this foundation can support **trustworthy AI decisions**.

The success criterion is NOT "all data imported". It is:

> **Every recommendation can be traced: Entity → Evidence → Decision Factor**

This is what distinguishes Hermes Education Engine from a typical RAG school search bot.

---

## Check 1 — Entity Resolution Quality Report

### Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| `total_entities` | Total schools in source dataset | — |
| `matched` | Schools successfully linked to master | — |
| `ambiguous` | Schools with multiple possible matches | — |
| `unmatched` | Schools with no match found | — |
| `match_rate` | matched / total_entities | >= 95% |
| `ambiguity_rate` | ambiguous / total_entities | < 5% |
| `unresolved_rate` | unmatched / total_entities | < 3% |

### Confidence Distribution

Track the distribution of match confidence scores:

```json
{
  "confidence_distribution": {
    "1.0 (exact school_no)": 900,
    "0.95-1.0 (exact name + district)": 200,
    "0.90-0.95 (exact name, no district)": 50,
    "0.85-0.90 (alias match)": 30,
    "0.70-0.85 (fuzzy match)": 15,
    "< 0.70 (weak match)": 5
  }
}
```

### Layer-Specific Rates

| Layer | Target | Minimum |
|-------|--------|---------|
| Secondary | >= 98% | >= 95% |
| Primary | >= 95% | >= 90% |
| Kindergarten | >= 90% | >= 85% |

### Diagnostic Value

If Secondary = 99% but Kindergarten = 88%, this indicates:
- NOT a system problem
- KG naming data needs alias supplementation
- KG names change more frequently, Chinese/English variations larger

### Output Format

```json
{
  "report_type": "entity_resolution_quality",
  "generated_at": "2026-07-27T10:00:00Z",
  "summary": {
    "total_entities": 1200,
    "matched": 1180,
    "ambiguous": 15,
    "unmatched": 5,
    "match_rate": 0.983,
    "ambiguity_rate": 0.0125,
    "unresolved_rate": 0.0042
  },
  "confidence_distribution": {
    "1.0": 900,
    "0.95-1.0": 200,
    "0.90-0.95": 50,
    "0.85-0.90": 30,
    "0.70-0.85": 15,
    "< 0.70": 5
  },
  "layer_specific": {
    "secondary": {"total": 441, "matched": 437, "rate": 0.991},
    "primary": {"total": 500, "matched": 475, "rate": 0.950},
    "kindergarten": {"total": 259, "matched": 228, "rate": 0.880}
  },
  "ambiguous_entities": [
    {
      "query": "聖保羅中學",
      "matches": ["聖保羅男女中學", "聖保羅書院", "聖保羅堂幼稚園"],
      "resolution": "clarification_required"
    }
  ],
  "unmatched_entities": [
    {
      "query": "某某新型學校",
      "reason": "no_match_found",
      "recommendation": "manual_mapping"
    }
  ]
}
```

---

## Check 2 — Evidence Retrieval Quality

### Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| `precision@5` | Top 5 results that are relevant | >= 80% |
| `citation_coverage` | Results with source attribution | 100% |
| `language_match` | Results match query language | >= 90% |

### Retrieval Precision@5

**Definition**: For a given query, how many of the top 5 retrieved evidence chunks are actually relevant?

**Test Queries**:
1. "英皇書院有什麼特色？" → Expect: School Profile, Curriculum, Mission
2. "沙田中學 Band 1 推薦" → Expect: Academic Signal, School List
3. "九龍塘幼稚園 K1 空缺" → Expect: Vacancy Status, School List

**Scoring**:
- 5/5 relevant = 1.0
- 4/5 relevant = 0.8
- 3/5 relevant = 0.6
- < 3/5 relevant = fail (investigate)

### Citation Coverage

Every retrieved evidence chunk MUST have:
- `source` field (e.g., "EDB_SSP", "CHSC")
- `source_version` field (e.g., "2025_2026")
- `confidence` field (0.0-1.0)

**Target**: 100% citation coverage. No evidence without provenance.

### Language Match

For Chinese queries, at least 80% of results should be Chinese evidence.
For English queries, at least 80% of results should be English evidence.

Exception: School names and addresses may appear in either language.

### Output Format

```json
{
  "report_type": "evidence_retrieval_quality",
  "generated_at": "2026-07-27T10:00:00Z",
  "summary": {
    "total_queries": 20,
    "avg_precision_at_5": 0.85,
    "citation_coverage": 1.0,
    "language_match_rate": 0.92
  },
  "query_results": [
    {
      "query": "英皇書院有什麼特色？",
      "top_5_relevant": 4,
      "precision@5": 0.8,
      "results": [
        {"rank": 1, "relevant": true, "source": "EDB_SSP", "language": "zh-HK"},
        {"rank": 2, "relevant": true, "source": "EDB_SSP", "language": "zh-HK"},
        {"rank": 3, "relevant": true, "source": "CHSC", "language": "en"},
        {"rank": 4, "relevant": true, "source": "EDB_SSP", "language": "zh-HK"},
        {"rank": 5, "relevant": false, "source": "EDB_LOC", "language": "zh-HK"}
      ]
    }
  ]
}
```

---

## Check 3 — Decision Explanation Integrity

### Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| `evidence_coverage` | Decision factors with evidence / Total factors | 100% |
| `unsupported_claim_count` | Claims without evidence trace | 0 |
| `trace_completeness` | Full trace: Entity → Evidence → Factor | 100% |

### Evidence Coverage

Every factor mentioned in a recommendation MUST have a corresponding evidence trace:

**Example — Valid**:
```
Recommendation: 推薦英皇書院
Factors:
1. Band 1 → Evidence: CHSC academic_signal, confidence=0.9
2. 距離 3km → Evidence: EDB coordinates, confidence=1.0
3. 英文授課 → Evidence: EDB_SSP language_policy, confidence=0.95
Evidence coverage: 3/3 = 100%
```

**Example — Invalid**:
```
Recommendation: 推薦英皇書院
Factors:
1. Band 1 → Evidence: CHSC academic_signal
2. 距離 3km → Evidence: EDB coordinates
3. 校風良好 → Evidence: ❌ (no source, AI hallucination)
Evidence coverage: 2/3 = 67% → FAIL
```

### Trace Completeness

Each trace step must be verifiable:

```
Step 1: Entity Resolution
  Query: "英皇書院"
  → Resolved to: school_master_id=1, edb_school_no=510408
  → Method: exact_name_zh
  → Confidence: 0.99

Step 2: Evidence Retrieval
  Query: school_master_id=1, profile_type=language_policy
  → Retrieved: evidence_chunk_id=1234
  → Source: EDB_SSP_2025_2026
  → Content: "Medium of Instruction: English"

Step 3: Decision Factor
  Factor: language_policy = English
  → Source: evidence_chunk_id=1234
  → Weight: 0.15 (preference_match component)
  → Traceable: YES
```

### Zero Tolerance for Unsupported Claims

If ANY claim in a recommendation cannot be traced to evidence:
- Log as `unsupported_claim`
- Flag for investigation
- Do NOT return to user until resolved

### Output Format

```json
{
  "report_type": "decision_explanation_integrity",
  "generated_at": "2026-07-27T10:00:00Z",
  "summary": {
    "total_recommendations": 50,
    "avg_evidence_coverage": 0.98,
    "unsupported_claims": 2,
    "trace_completeness": 0.98
  },
  "recommendations": [
    {
      "recommendation_id": "rec_001",
      "school": "英皇書院",
      "factors": [
        {"factor": "Band 1", "evidence_source": "CHSC", "traceable": true},
        {"factor": "距離 3km", "evidence_source": "EDB_COORD", "traceable": true},
        {"factor": "英文授課", "evidence_source": "EDB_SSP", "traceable": true}
      ],
      "evidence_coverage": 1.0,
      "trace_complete": true
    }
  ],
  "unsupported_claims": [
    {
      "recommendation_id": "rec_023",
      "school": "某某學校",
      "claim": "校風良好",
      "issue": "no_evidence_source",
      "severity": "high"
    }
  ]
}
```

---

## Execution Order

### Step 0: Backup Current State
```bash
# Save migration v1.2.0
pg_dump -h hermes-postgres -U hermes -d hermes -s > backup_phase10_2_schema.sql

# Save golden cases
cp tests/golden/education_golden_cases_v2.json backup_golden_cases.json
```

### Step 1: Entity Resolution Dry Run
```bash
python -m ingestion.entity_resolution_validator --dry-run
# Output: entity_resolution_report.json
```

### Step 2: Review Report
Verify:
- Overall >= 95%
- Secondary >= 98%
- Primary >= 95%
- Kindergarten >= 90%

### Step 3: Write Mapping (only if Step 2 passes)
```bash
python -m ingestion.entity_resolution_validator --write
```

### Step 4: Layer 1 Ingestion
- School Location (EDB JSON)
- School Registration (XML)
- Generate school_alias from official names

### Step 5: Layer 4 Evidence (RAG content first)
- Secondary Overview (EDB SSP, bilingual)
- Primary Overview (EDB PSP, bilingual)
- KG Overview (EDB KGP, bilingual)

### Step 6: Graph Layer
- School Network (SSPA)
- Through-train Schools

### Step 7: Dynamic Layer (highest update frequency)
- Vacancy (latest snapshot)
- Cost Profiles

### Step 8: Runtime Validation
Execute 5 validation cases + 3 operational checks.

---

## Success Criteria

| Check | Metric | Target |
|-------|--------|--------|
| Entity Resolution | Overall match rate | >= 95% |
| Entity Resolution | Secondary match rate | >= 98% |
| Entity Resolution | Primary match rate | >= 95% |
| Entity Resolution | Kindergarten match rate | >= 90% |
| Evidence Retrieval | precision@5 | >= 80% |
| Evidence Retrieval | citation_coverage | 100% |
| Evidence Retrieval | language_match | >= 90% |
| Decision Explanation | evidence_coverage | 100% |
| Decision Explanation | unsupported_claim_count | 0 |
| Decision Explanation | trace_completeness | 100% |

---

## Known Limitations (If Any)

If Phase 10.3 reveals issues:
1. Document here
2. Do NOT modify Phase 10.2 schema
3. Address in Phase 10.4 (if critical)

---

## Signature

```
Phase 10.3 — Operational Metrics
Version: 1.0
Date: 2026-07-27
Status: Active
```