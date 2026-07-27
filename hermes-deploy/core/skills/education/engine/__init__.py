# Education Engine — Entry Point
# Orchestrates the full recommendation pipeline

from .profile import build_profiles
from .matching import match_schools
from .ranking import rank_schools
from .evidence import retrieve_evidence
from .recommendation import generate_recommendations
from .constraint_extractor import extract_constraints, QueryConstraints
from .trace_writer import RecommendationTracer, TraceStep
from .feedback_capture import FeedbackCapture, get_feedback_capture
from skills.education.data.ranking_config import config_for_profile
from skills.education.data.evidence_tracer import tracer as evidence_tracer
from skills.education.entity import (
    EntityResolver,
    AliasMatcher,
    detect_entity_intent,
    generate_comparison,
    school_data_to_comparison,
)
from skills.education.intent import education_context_score, get_education_context
from skills.education.presentation.locale import detect_locale, resolve_locale


async def run_engine(ctx) -> str:
    """
    Full education decision pipeline:
    Entity Detection → Comparison Mode OR Education Context → Constraint Extraction → Profile → Match → Evidence → Rank → Recommend

    Phase 10.1.7-C: Full trace persistence at each step.
    Phase 10.2: Preference memory recall for personalized ranking context.
    """
    # 0. Entity Detection — Check for comparison intent FIRST
    intent = detect_entity_intent(ctx.raw_message)

    if intent.is_comparison and len(intent.entities) >= 2:
        # Comparison Mode: resolve entities → fetch schools → comparison output
        return await _run_comparison_mode(ctx, intent)

    # Initialize tracer (needs DB connection)
    tracer = await _create_tracer()

    # Create session for trace
    session_id = await tracer.create_session(
        user_id=ctx.user_id,
        engine_version="v1.0.7",
    )

    # 0.5 Education Context Scoring — boost confidence and extract interests
    edu_context = get_education_context(ctx.raw_message)

    await tracer.log_step(session_id, TraceStep(
        step="education_context",
        step_order=0,
        input_summary={"query": ctx.raw_message},
        output_summary=edu_context or {"is_education": False},
    ))

    # 0.6 Preference Memory Recall — Phase 10.2
    feedback = get_feedback_capture(tracer.pool)
    pref_context = await feedback.get_preference_context(ctx.user_id)

    await tracer.log_step(session_id, TraceStep(
        step="preference_recall",
        step_order=1,
        input_summary={"user_id": ctx.user_id},
        output_summary=pref_context or {"preferences": "none"},
    ))

    # 1. Extract constraints from query BEFORE profile building
    # Pass preference context for personalized constraint extraction
    query_constraints = extract_constraints(
        ctx.raw_message,
        edu_context=edu_context,
        pref_context=pref_context,
    )

    await tracer.log_step(session_id, TraceStep(
        step="constraint_extraction",
        step_order=2,
        input_summary={"query": ctx.raw_message, "edu_context": edu_context, "pref_context": pref_context},
        output_summary={
            "districts": query_constraints.districts,
            "gender": query_constraints.gender,
            "school_types": query_constraints.school_types,
            "language": query_constraints.language,
            "interests": query_constraints.interests,
            "band": query_constraints.band,
            "avoid_schools": query_constraints.avoid_schools,
        },
    ))

    # 2. Build family and child profiles from memory + query constraints
    family, child, criteria = build_profiles(ctx, query_constraints)

    # 3. Fetch candidate schools from knowledge service (with Qdrant filter)
    schools = await _fetch_schools(ctx.domain, ctx.knowledge_url, constraints=query_constraints)

    await tracer.log_step(session_id, TraceStep(
        step="candidate_fetch",
        step_order=3,
        input_summary={"filters": _build_filter_payload(query_constraints)},
        output_summary={"total_fetched": len(schools)},
        schools_considered=len(schools),
    ))

    # 4. Hard constraint filtering (district, gender, school_type from query)
    # Phase 10.2: Also filter out avoid_schools from preference memory
    eligible, reject_reasons = match_schools(schools, family, child, query_constraints)

    await tracer.log_step(session_id, TraceStep(
        step="constraint_filtering",
        step_order=4,
        input_summary={"total_input": len(schools)},
        output_summary={
            "eligible_count": len(eligible),
            "rejected_count": len(reject_reasons),
            "sample_rejections": reject_reasons[:5],
        },
        schools_considered=len(eligible),
    ))

    # 5. Retrieve evidence for eligible schools
    evidence_map = await retrieve_evidence(
        ctx.domain, eligible, family, child, knowledge_url=ctx.knowledge_url
    )

    # 6. Select ranking config based on family profile
    config = config_for_profile(family)

    # 7. Score and rank with configurable weights
    ranked = rank_schools(eligible, family, child, evidence_map, criteria,
                          config=config, query_constraints=query_constraints)

    await tracer.log_step(session_id, TraceStep(
        step="ranking",
        step_order=5,
        input_summary={"total_ranked": len(ranked)},
        output_summary={
            "top_5": [
                {
                    "name": e.get("school", e).get("name", "unknown"),
                    "score": e.get("total_score", 0),
                }
                for e in ranked[:5]
            ],
        },
        schools_considered=len(ranked),
    ))

    # 8. Build evidence chains for top schools
    evidence_chains = []
    for entry in ranked[:5]:
        school = entry["school"]
        chain = evidence_tracer.build_chain(
            school_id=school.get("school_id", school.get("name", "unknown")),
            school_name=school.get("name", "Unknown"),
            total_score=entry["total_score"],
            school_data=school,
        )
        evidence_chains.append(chain)

    # 9. Generate reasoned recommendations with evidence chains
    # Phase 10.1.7-D/E: Resolve locale (user preference → query language → default zh-TW)
    # Phase 10.1.7-E: Pass query_constraints for reasoning generation from trace
    # Phase 10.1.9: trace_id links DecisionObject → Recommendation Trace (mandatory)
    locale = resolve_locale(ctx.raw_message)
    response = generate_recommendations(ranked, evidence_map, family, child,
                                         evidence_chains=evidence_chains,
                                         query_constraints=query_constraints,
                                         locale=locale,
                                         query=ctx.raw_message,
                                         session_id=session_id)

    # 10. Persist results and finalize session
    await tracer.save_results(session_id, ranked)
    await tracer.finalize_session(
        session_id,
        total_considered=len(schools),
        total_ranked=len(ranked),
    )

    return response


async def _create_tracer() -> RecommendationTracer:
    """Create RecommendationTracer with DB connection."""
    import asyncpg
    import os

    pg_host = os.environ.get("POSTGRES_HOST", "hermes-postgres")
    pg_port = int(os.environ.get("POSTGRES_PORT", "5432"))
    pg_user = os.environ.get("POSTGRES_USER", "hermes")
    pg_pass = os.environ.get("POSTGRES_PASSWORD", "")
    pg_db = os.environ.get("POSTGRES_DB", "hermes")

    conn = await asyncpg.connect(
        host=pg_host, port=pg_port, user=pg_user,
        password=pg_pass, database=pg_db, ssl=False
    )
    return RecommendationTracer(conn)


async def _run_comparison_mode(ctx, intent) -> str:
    """Run comparison mode for entity comparison queries.

    Pipeline:
        1. Resolve entities to school_ids
        2. Fetch school data from knowledge service
        3. Fetch school alias map (Chinese names)
        4. Generate evidence-backed comparison output (localized)
    """
    import asyncpg
    import os

    # Get database connection from environment
    pg_host = os.environ.get("POSTGRES_HOST", "hermes-postgres")
    pg_port = int(os.environ.get("POSTGRES_PORT", "5432"))
    pg_user = os.environ.get("POSTGRES_USER", "hermes")
    pg_pass = os.environ.get("POSTGRES_PASSWORD", "")
    pg_db = os.environ.get("POSTGRES_DB", "hermes")

    # Connect using explicit parameters (avoids URL encoding issues with special chars)
    conn = await asyncpg.connect(
        host=pg_host, port=pg_port, user=pg_user,
        password=pg_pass, database=pg_db, ssl=False
    )

    try:
        matcher = AliasMatcher(conn)

        # Resolve all entities
        resolved_entities = []
        for entity_text in intent.entities:
            result = await matcher.resolve(entity_text, min_confidence=0.8)
            resolved_entities.append(result)

        # Check resolution results
        unresolved = [e for e in resolved_entities if e.school_id is None]
        if unresolved:
            # Some entities couldn't be resolved
            lines = ["=== Entity Resolution ===", ""]
            for entity in resolved_entities:
                if entity.school_id:
                    lines.append(f"✅ {entity.query_text} → {entity.matched_name} ({entity.confidence:.2f})")
                else:
                    lines.append(f"❌ {entity.query_text} → Could not resolve")
                    if entity.alternatives:
                        lines.append(f"   Did you mean: {', '.join(a.alias for a in entity.alternatives[:3])}?")
            return "\n".join(lines)

        # Fetch school data for resolved entities
        schools_data = []
        for entity in resolved_entities:
            school_data = await _fetch_school_by_id(ctx.domain, ctx.knowledge_url, entity.school_id)
            if school_data:
                schools_data.append(school_data)

        if len(schools_data) < 2:
            return "（無法比較：找不到足夠的學校資料）"

        # Phase 10.1.7-D: Fetch school alias map for Chinese names
        school_ids = [s.get("school_id") for s in schools_data if s.get("school_id")]
        school_alias_map = await matcher.get_school_alias_map(school_ids)

        # Convert to comparison format and generate output
        # Phase 10.1.7-D: Resolve locale (user preference → query language → default zh-TW)
        locale = resolve_locale(ctx.raw_message)
        comparison_schools = [school_data_to_comparison(s) for s in schools_data]
        return generate_comparison(comparison_schools, locale=locale, query=ctx.raw_message,
                                   school_alias_map=school_alias_map)

    finally:
        await conn.close()


async def _fetch_school_by_id(domain: str, knowledge_url: str, school_id: str) -> dict | None:
    """Fetch single school data by school_id from knowledge service."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Try knowledge service first
            resp = await client.post(
                f"{knowledge_url}/knowledge/search",
                json={
                    "domain": domain,
                    "query": f"school_id:{school_id}",
                    "filters": {"school_id": school_id},
                    "limit": 1,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            docs = data.get("documents", [])
            if docs:
                doc = docs[0]
                # Flatten metadata to top-level
                metadata = doc.pop("metadata", {})
                return {**metadata, **doc}
    except Exception:
        pass

    return None


async def _fetch_schools(domain: str, knowledge_url: str,
                         constraints: QueryConstraints | None = None) -> list[dict]:
    """Fetch schools from knowledge base, with optional Qdrant payload filter.

    If constraints are provided, pass them as filters to the knowledge service
    for server-side filtering. Falls back to demo data if knowledge returns
    unstructured documents.
    """
    import httpx

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Build filter payload from constraints
            filters = _build_filter_payload(constraints)

            resp = await client.post(
                f"{knowledge_url}/knowledge/search",
                json={"domain": domain, "query": "school list", "filters": filters, "limit": 500},
            )
            resp.raise_for_status()
            data = resp.json()
            docs = data.get("documents", [])
            # Knowledge service returns {content, source, score, metadata}
            # School name lives in metadata.name — only use if structured
            if docs and all("name" in d.get("metadata", {}) for d in docs):
                # Flatten metadata to top-level for downstream processing
                return [{**d.pop("metadata", {}), **d} for d in docs]
    except Exception:
        pass

    # Fallback: demo schools for development/testing
    return _demo_schools()


def _build_filter_payload(constraints: QueryConstraints | None) -> dict:
    """Build Qdrant filter payload from query constraints."""
    filters = {}
    if not constraints:
        return filters

    # District filter — match any in list
    if constraints.districts:
        filters["district"] = constraints.districts

    # School type filter — match any in list
    if constraints.school_types:
        filters["school_type"] = constraints.school_types

    # Gender filter — single value
    if constraints.gender:
        filters["student_gender"] = [constraints.gender]

    return filters


def _demo_schools() -> list[dict]:
    """Demo HK school data for development without a populated knowledge base."""
    return [
        {
            "name": "St. Paul's Co-educational College",
            "district": "Central and Western",
            "band": "Band 1",
            "type": "direct_subsidy_scheme",
            "language": "english",
            "levels": ["secondary"],
            "gender": "co_ed",
            "annual_fee": 65000,
            "activities": ["music", "sports", "debate", "stem"],
            "religion": "protestant",
        },
        {
            "name": "Diocesan Girls' School",
            "district": "Yau Tsim Mong",
            "band": "Band 1",
            "type": "aided",
            "language": "english",
            "levels": ["secondary"],
            "gender": "girls_only",
            "annual_fee": 0,
            "activities": ["music", "sports", "drama"],
            "religion": "protestant",
        },
        {
            "name": "La Salle College",
            "district": "Kowloon City",
            "band": "Band 1",
            "type": "aided",
            "language": "english",
            "levels": ["secondary"],
            "gender": "boys_only",
            "annual_fee": 0,
            "activities": ["sports", "music", "stem"],
            "religion": "catholic",
        },
        {
            "name": "Sha Tin Government Secondary School",
            "district": "Sha Tin",
            "band": "Band 2",
            "type": "government",
            "language": "chinese",
            "levels": ["secondary"],
            "gender": "co_ed",
            "annual_fee": 0,
            "activities": ["sports", "arts", "community_service"],
            "religion": "none",
        },
        {
            "name": "TWGHs Wong Fut Nam College",
            "district": "Kowloon City",
            "band": "Band 2",
            "type": "aided",
            "language": "chinese",
            "levels": ["secondary"],
            "gender": "co_ed",
            "annual_fee": 0,
            "activities": ["music", "sports"],
            "religion": "none",
        },
        {
            "name": "Yuen Long Public Secondary School",
            "district": "Yuen Long",
            "band": "Band 3",
            "type": "government",
            "language": "chinese",
            "levels": ["secondary"],
            "gender": "co_ed",
            "annual_fee": 0,
            "activities": ["sports"],
            "religion": "none",
        },
        {
            "name": "St. Paul's Convent School",
            "district": "Wan Chai",
            "band": "Band 1",
            "type": "private",
            "language": "english",
            "levels": ["primary", "secondary"],
            "gender": "girls_only",
            "annual_fee": 55000,
            "activities": ["music", "drama", "languages"],
            "religion": "catholic",
        },
        {
            "name": "Kowloon Junior School",
            "district": "Kowloon City",
            "band": "Band 1",
            "type": "international",
            "language": "english",
            "levels": ["primary"],
            "gender": "co_ed",
            "annual_fee": 90000,
            "activities": ["sports", "arts", "stem", "languages"],
            "religion": "none",
        },
    ]
