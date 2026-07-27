# Phase 10.3 — Education Intelligence Runtime Validation

**Status**: Planned
**Depends on**: Phase 10.2 Architecture Freeze v1.2.0 (Complete)
**Goal**: Validate that the Education Data Foundation can drive real Decision Engine queries

---

## Purpose

Phase 10.2 built the **data foundation**. Phase 10.3 validates that this foundation can support **real user queries** end-to-end:

```
Real User Query
       ↓
Entity Resolution (bilingual, multi-stage)
       ↓
Knowledge Graph Traversal
       ↓
Ranking (constraint 0.5 + academic 0.25 + preference 0.15 + evidence 0.10)
       ↓
Evidence Retrieval (RAG with provenance)
       ↓
Answer Generation (with decision trace)
```

---

## Validation Cases

### Case 1: Band 1 Boy in Sha Tin (Full Decision Flow)

**Input**: "沙田 Band 1 男仔，有英文中學推薦嗎？"

**Expected Flow**:
1. Entity Resolution: "沙田" → Sha Tin district
2. Admission Structure: Sha Tin → Primary Net 91 → Secondary Network
3. Academic Signal: Band 1 filter (from CHSC)
4. Language Policy: EMI/English filter (from EDB SSP)
5. Gender: Boys filter
6. Ranking: Apply frozen weights
7. Evidence: Generate reasoning with per-field source attribution

**Validation Points**:
- [ ] Entity Resolution correctly identifies Sha Tin schools
- [ ] School Net lookup returns correct secondary schools
- [ ] Academic signal filter works (Band 1)
- [ ] Language policy filter works (EMI)
- [ ] Gender filter works (Boys)
- [ ] Ranking weights are frozen (0.5/0.25/0.15/0.10)
- [ ] Evidence provenance cites correct sources

### Case 2: Ambiguous Entity — Clarification Flow

**Input**: "聖保羅中學好不好？"

**Expected Flow**:
1. Entity Resolution: "聖保羅" → multiple matches
2. Ambiguity Detection: >1 match with similar confidence
3. Clarification: Ask user to specify which St. Paul's school

**Validation Points**:
- [ ] System detects ambiguity (St. Paul's Co-ed, St. Paul's College, St. Paul's KG)
- [ ] System does NOT auto-recommend
- [ ] System asks clarification with options
- [ ] User selection resolves to single entity

### Case 3: KG Vacancy Query (Real-time Data)

**Input**: "九龍塘幼稚園 K1 還有位嗎？"

**Expected Flow**:
1. Entity Resolution: "九龍塘" → Kowloon Tong district
2. School Level: Kindergarten filter
3. Availability: Query latest K1 vacancy snapshot
4. Response: List schools with vacancy_status = 'Y' or 'L'

**Validation Points**:
- [ ] Location filter works (Kowloon Tong)
- [ ] Level filter works (Kindergarten)
- [ ] Vacancy query uses latest snapshot_date
- [ ] Response includes source attribution (EDB KG Vacancy)
- [ ] Response includes snapshot date (time-sensitive data)

### Case 4: Through-train School Query (Graph Traversal)

**Input**: "播道書院係唔係一條龍學校？"

**Expected Flow**:
1. Entity Resolution: "播道書院" → Evangel College
2. Graph Traversal: Query school_relationship for through_train
3. Response: Yes, with linked secondary school

**Validation Points**:
- [ ] Entity Resolution finds Evangel College
- [ ] Graph traversal follows through_train relationship
- [ ] Response includes both primary and secondary schools
- [ ] Response cites EDB as source

### Case 5: Bilingual Query (English)

**Input**: "Compare King's College and La Salle College"

**Expected Flow**:
1. Entity Resolution: "King's College" → 英皇書院 (via alias)
2. Entity Resolution: "La Salle College" → 喇沙書院 (via alias)
3. Locale Detection: English
4. Profile Retrieval: Both schools' profiles
5. Comparison: Side-by-side with evidence

**Validation Points**:
- [ ] Alias lookup works for English names
- [ ] Both entities resolved correctly
- [ ] Locale detected as English
- [ ] Profiles retrieved in English
- [ ] Comparison includes evidence provenance

---

## Execution Order

### Step 1: Entity Resolution Validation
```bash
# Dry-run only — no writes
python -m ingestion.entity_resolution_validator --dry-run

# Review report
cat /data/ingestion/entity_resolution_report.json
```

**Pass Criteria**:
- Overall match rate >= 95%
- Secondary >= 98%
- Primary >= 95%
- Kindergarten >= 90%

### Step 2: Ingest Layer 1 (Identity)
- School Location (EDB JSON)
- School Registration (XML)
- School Aliases (generated from official names)

### Step 3: Ingest Layer 4 (Profiles)
- Secondary School Profiles (EDB SSP, bilingual)
- Primary School Profiles (EDB PSP, bilingual)
- Kindergarten Profiles (EDB KGP, bilingual)

### Step 4: Ingest Layer 2 + 3 (Graph)
- Secondary School Network (SSPA)
- Primary School Net (POA)
- Through-train Schools

### Step 5: Ingest Layer 5 + 6 (Dynamic)
- KG Vacancy (latest snapshot)
- Cost Profiles (from SSP/PSP/KGP)

### Step 6: Runtime Validation
- Execute 5 validation cases above
- Verify end-to-end flow
- Document any issues

---

## Success Criteria

| Component | Criteria | Status |
|-----------|----------|--------|
| Entity Resolution | Overall >= 95%, all layers above threshold | ⏳ Pending |
| Bilingual Support | ZH and EN queries both work | ⏳ Pending |
| Ambiguous Handling | Clarification flow triggers correctly | ⏳ Pending |
| Graph Traversal | Through-train queries return linked schools | ⏳ Pending |
| Evidence Provenance | All answers cite correct sources | ⏳ Pending |
| Ranking Weights | Frozen at 0.5/0.25/0.15/0.10 | ⏳ Pending |
| Decision Trace | All recommendations have trace_id | ⏳ Pending |

---

## Out of Scope (Future Phases)

- **School Website Agent**: Crawl school websites for fee data, news, events
- **HKET Integration**: Popularity/parent signal data
- **Ranking Weight Changes**: Any adjustment requires v2.0 bump
- **Travel Time Score**: MTR/bus API integration
- **Social Media Sentiment**: Parent forums, news sentiment
- **More School Rankings**: Additional ranking dimensions

---

## Architecture Freeze Reminder

Phase 10.2 schema is **FROZEN** at v1.2.0. Phase 10.3 does NOT modify schema — it validates the existing schema with real data and real queries.

If Phase 10.3 reveals schema issues, they should be:
1. Documented as known limitations
2. Addressed in Phase 10.4 (if critical) or future phases
3. NOT fixed by modifying Phase 10.2 migration

---

## Signature

```
Phase 10.3 — Education Intelligence Runtime Validation
Depends on: Phase 10.2 Architecture Freeze v1.2.0
Status: Planned
```