# Phase 10.1.9: Trace Step Enum (FREEZE)
# Fixed trace steps for Decision Intelligence analytics.
# DO NOT MODIFY without schema version bump.

from enum import Enum


class TraceStep(str, Enum):
    """Fixed trace step enumeration.

    Freeze rules:
        - Order matters (pipeline sequence)
        - Names are API contract (don't rename without version bump)
        - New steps can be added but existing ones cannot be removed
    """
    INTENT_DETECTION = "intent_detection"
    ENTITY_RESOLUTION = "entity_resolution"
    CONSTRAINT_EXTRACTION = "constraint_extraction"
    CANDIDATE_RETRIEVAL = "candidate_retrieval"
    CONSTRAINT_FILTERING = "constraint_filtering"
    RANKING = "ranking"
    REASONING_GENERATION = "reasoning_generation"
    PRESENTATION = "presentation"


# Ordered pipeline steps (for validation)
PIPELINE_ORDER = [
    TraceStep.INTENT_DETECTION,
    TraceStep.ENTITY_RESOLUTION,
    TraceStep.CONSTRAINT_EXTRACTION,
    TraceStep.CANDIDATE_RETRIEVAL,
    TraceStep.CONSTRAINT_FILTERING,
    TraceStep.RANKING,
    TraceStep.REASONING_GENERATION,
    TraceStep.PRESENTATION,
]


# Analytics categories (for Phase 11 Learning)
FAILURE_POINTS = {
    "entity_resolution": "Entity cannot be resolved from query",
    "constraint_extraction": "Cannot extract valid constraints",
    "candidate_retrieval": "No candidates found in knowledge base",
    "constraint_filtering": "All candidates filtered out by hard constraints",
    "ranking": "Ranking produced no viable results",
}
