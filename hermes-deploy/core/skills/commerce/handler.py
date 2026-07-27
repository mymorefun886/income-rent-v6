from skills.base import BaseSkill, SkillResult
from context import TaskContext


class CommerceSkill(BaseSkill):
    """Commerce domain — product listings, pricing, marketplace analysis."""

    async def execute(self, ctx: TaskContext) -> SkillResult:
        return SkillResult(
            answer=(
                f"[Commerce] Processing: '{ctx.raw_message[:120]}'. "
                f"Skill stub active — full reasoning in Phase 6."
            ),
            evidence=[],
            confidence=ctx.intent_confidence,
            metadata={"domain": "commerce", "status": "stub"},
        )
