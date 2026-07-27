from skills.base import BaseSkill, SkillResult
from context import TaskContext
from skills.education.engine import run_engine


class EducationSkill(BaseSkill):
    """Education domain — K-12 school recommendation engine for Hong Kong parents."""

    async def execute(self, ctx: TaskContext) -> SkillResult:
        response = await run_engine(ctx)

        return SkillResult(
            answer=response,
            evidence=[],
            confidence=ctx.intent_confidence,
            metadata={
                "domain": "education",
                "engine": "v1.0",
                "family_preferences": len(ctx.recalled_preferences),
                "memories_recalled": len(ctx.recalled_memories),
            },
        )
