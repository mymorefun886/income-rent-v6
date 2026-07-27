# Hermes Core — Skill Contract
# Every domain skill must inherit BaseSkill and implement execute()

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from context import TaskContext


@dataclass
class SkillResult:
    """Output from a skill execution. Returned to Core for response assembly."""

    answer: str = ""
    evidence: list = field(default_factory=list)
    confidence: float = 0.0
    metadata: dict = field(default_factory=dict)


class BaseSkill(ABC):
    """Contract all domain skills must fulfill.

    Skills are stateless transforms: TaskContext → SkillResult.
    They do NOT access databases, Telegram, or external APIs directly.
    All memory operations go through the Core pipeline.
    """

    name: str = "base"
    version: str = "0.1.0"
    description: str = ""

    @abstractmethod
    async def execute(self, ctx: TaskContext) -> SkillResult:
        """Process the request and return a result.

        Args:
            ctx: Full request context including intent, recalled memory, user profile.

        Returns:
            SkillResult with answer, evidence list, confidence score, and metadata.
        """
        ...
