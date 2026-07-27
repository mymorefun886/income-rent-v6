from skills.base import BaseSkill, SkillResult
from context import TaskContext


class PersonalSkill(BaseSkill):
    """Personal assistant — calendar, reminders, family management."""

    async def execute(self, ctx: TaskContext) -> SkillResult:
        return SkillResult(
            answer=(
                f"[Personal] Processing: '{ctx.raw_message[:120]}'. "
                f"Skill stub active — full reasoning in Phase 6."
            ),
            evidence=[],
            confidence=ctx.intent_confidence,
            metadata={"domain": "personal", "status": "stub"},
        )
