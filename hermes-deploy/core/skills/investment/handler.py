from skills.base import BaseSkill, SkillResult
from context import TaskContext


class InvestmentSkill(BaseSkill):
    """Investment domain — market analysis, stock research, portfolio insights."""

    async def execute(self, ctx: TaskContext) -> SkillResult:
        return SkillResult(
            answer=(
                f"[Investment] Processing: '{ctx.raw_message[:120]}'. "
                f"Skill stub active — full reasoning in Phase 6."
            ),
            evidence=[],
            confidence=ctx.intent_confidence,
            metadata={"domain": "investment", "status": "stub"},
        )
