# Hermes Core — Task Pipeline
# Orchestrates: intent → recall → route → execute → remember

from context import TaskContext
from memory_client import MemoryClient
from router import detect_intent, select_skill
from skills.registry import registry

memory = MemoryClient()


async def process(ctx: TaskContext) -> TaskContext:
    """Main pipeline: the Core control loop."""

    # 1. Detect intent
    ctx = detect_intent(ctx)

    # 2. Recall memory
    recalled = await memory.recall(ctx.user_id, domain=ctx.domain)
    ctx.recalled_profile = recalled.get("profile", {})
    ctx.recalled_preferences = recalled.get("preferences", [])
    ctx.recalled_memories = recalled.get("events", [])

    # 3. Select skill
    ctx = select_skill(ctx)

    # 4. Execute skill
    skill = registry.get(ctx.selected_skill)
    if skill:
        result = await skill.execute(ctx)
        ctx.response = result.answer
        ctx.skill_result = result
    else:
        ctx.response = f"[Core] No skill found for '{ctx.selected_skill}'"

    # 5. Remember this interaction
    await memory.store(ctx.user_id, "event", {
        "domain": ctx.domain,
        "intent": ctx.intent,
        "skill": ctx.selected_skill,
        "message": ctx.raw_message[:256],
        "response": ctx.response,
    })

    return ctx.finish()
