# Hermes Core — TaskContext
# Request context passed through the pipeline

from dataclasses import dataclass, field
from typing import Optional, TYPE_CHECKING
import time

if TYPE_CHECKING:
    from skills.base import SkillResult


@dataclass
class TaskContext:
    """Carries the full request state through intent → recall → skill → response."""

    user_id: str = "default"
    session_id: Optional[str] = None

    # Input
    raw_message: str = ""
    source: str = "unknown"

    # Session context (Phase 9.1 — cross-turn continuity)
    session_domain: str = "general"
    active_entity: Optional[str] = None
    last_intent: Optional[str] = None

    # Decision context (Phase 9.2.2 — cross-session decision lifecycle)
    active_decision_id: Optional[str] = None

    # Pipeline state
    intent: Optional[str] = None
    intent_confidence: float = 0.0
    domain: str = "general"

    # Memory recall results
    recalled_profile: dict = field(default_factory=dict)
    recalled_preferences: list = field(default_factory=list)
    recalled_memories: list = field(default_factory=list)

    # Skill routing
    selected_skill: Optional[str] = None
    skill_args: dict = field(default_factory=dict)

    # Skill execution result
    skill_result: Optional["SkillResult"] = None

    # Service URLs (for skill use via API, never direct DB)
    knowledge_url: str = "http://hermes-knowledge:8000"
    memory_url: str = "http://hermes-memory:8000"

    # Output
    response: Optional[str] = None
    decision_id: Optional[int] = None

    # Metadata
    started_at: float = field(default_factory=time.time)
    elapsed_ms: float = 0.0

    def finish(self):
        self.elapsed_ms = (time.time() - self.started_at) * 1000
        return self
