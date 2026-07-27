# Education Intent Package
# Intent Intelligence for education domain routing

from .education_context import (
    EducationContextResult,
    education_context_score,
    should_route_to_education,
    get_education_context,
    EDUCATION_CONTEXT_SIGNALS,
    EDUCATION_ROUTE_THRESHOLD,
)

__all__ = [
    "EducationContextResult",
    "education_context_score",
    "should_route_to_education",
    "get_education_context",
    "EDUCATION_CONTEXT_SIGNALS",
    "EDUCATION_ROUTE_THRESHOLD",
]
