# Hermes Knowledge — Data Models
# KnowledgeQuery → Qdrant → KnowledgeResult + Evidence

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Evidence:
    """A single retrieved document with provenance."""
    content: str = ""
    source: str = ""
    score: float = 0.0
    metadata: dict = field(default_factory=dict)


@dataclass
class KnowledgeResult:
    """Aggregated search result returned to the caller."""
    domain: str = "general"
    documents: list = field(default_factory=list)
    confidence: float = 0.0
