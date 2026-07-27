from skills.base import BaseSkill, SkillResult
from context import TaskContext


class GeneralSkill(BaseSkill):
    """Fallback skill — handles requests that don't match any domain skill."""

    async def execute(self, ctx: TaskContext) -> SkillResult:
        return SkillResult(
            answer=(
                f"[General] Received: '{ctx.raw_message[:120]}' "
                f"(intent={ctx.intent}, confidence={ctx.intent_confidence:.2f}). "
                f"No domain skill matched — waiting for Phase 5 LLM integration."
            ),
            evidence=[],
            confidence=ctx.intent_confidence,
            metadata={
                "domain": "general",
                "status": "stub",
                "profile_keys": list(ctx.recalled_profile.keys()) if ctx.recalled_profile else [],
            },
        )
