# Hermes Core — Task Pipeline
# Orchestrates: intent → recall → route → execute → remember → anchor

import re
from context import TaskContext
from memory_client import MemoryClient
from router import detect_intent, select_skill
from skills.registry import registry
from context_extractor import extract_anchors

memory = MemoryClient()


async def process(ctx: TaskContext) -> TaskContext:
    """Main pipeline: the Core control loop."""

    # 1. Detect intent (context-aware — inherits from session)
    ctx = detect_intent(ctx)

    # 2. Recall memory
    recalled = await memory.recall(ctx.user_id, domain=ctx.domain)
    ctx.recalled_profile = recalled.get("profile", {})
    ctx.recalled_preferences = recalled.get("preferences", [])
    ctx.recalled_memories = recalled.get("events", [])

    # 3. Handle memory_update intent — write to memory service directly
    if ctx.intent == "memory_update":
        await _handle_memory_update(ctx)

    # 4. Select skill
    ctx = select_skill(ctx)

    # 5. Execute skill
    skill = registry.get(ctx.selected_skill)
    if skill:
        result = await skill.execute(ctx)
        ctx.response = result.answer
        ctx.skill_result = result
    else:
        ctx.response = f"[Core] No skill found for '{ctx.selected_skill}'"

    # 6. Remember this interaction
    await memory.store(ctx.user_id, "event", {
        "domain": ctx.domain,
        "intent": ctx.intent,
        "skill": ctx.selected_skill,
        "message": ctx.raw_message[:256],
        "response": ctx.response,
    })

    # 7. Persist decision anchors for cross-session continuity
    anchors = extract_anchors(ctx)
    if anchors:
        for anchor in anchors:
            await memory.save_anchor(
                ctx.user_id,
                anchor["domain"],
                anchor["anchor_type"],
                anchor["entities"],
                anchor["context_data"],
                anchor["importance"],
            )

        # 8. Sync to decision_context (Phase 9.2.2)
        await _sync_decision_context(ctx, anchors)

    return ctx.finish()


async def _handle_memory_update(ctx: TaskContext) -> None:
    """Extract and persist user facts from memory_update messages."""
    msg = ctx.raw_message
    facts = {}

    # District: match standalone 住 (not part of 记住/記住)
    area_match = re.search(r'(?<![记記])(?:住|住喺|位於|在)([一-鿿]{2,6}(?:區|区)?)', msg)
    if area_match:
        facts["district"] = area_match.group(1)

    # Budget: 預算N萬 / 预算N万 / budget N
    budget_match = re.search(r'(?:預算|预算|budget)\s*(\d+)\s*萬', msg, re.IGNORECASE)
    if budget_match:
        facts["budget"] = int(budget_match.group(1)) * 10000

    # Child info: 我個仔/我个仔/小朋友/囡囡 + age/grade
    age_match = re.search(r'(?:我個仔|我个仔|小朋友|囡囡)\s*(\d+)\s*[歲岁]', msg)
    if age_match:
        facts["child_age"] = int(age_match.group(1))

    # Store extracted facts as preferences
    for key, value in facts.items():
        await memory.store(ctx.user_id, "preference", {
            "key": key,
            "value": str(value),
            "source": "conversation",
        })

    # Also store the raw message as an event
    await memory.store(ctx.user_id, "event", {
        "domain": "personal",
        "intent": "memory_update",
        "type": "user_fact",
        "text": msg[:256],
        "extracted": facts,
    })


async def _sync_decision_context(ctx: TaskContext, anchors: list[dict]) -> None:
    """Ensure active decision_context exists and sync entities from anchors."""
    for anchor in anchors:
        domain = anchor["domain"]
        entities = anchor.get("entities", [])
        if domain != "education" or not entities:
            continue

        # Find or create active decision for this user+domain
        decisions = await memory.list_decisions(ctx.user_id, domain=domain, status="active")
        decision_id = decisions[0]["id"] if decisions else None

        if decision_id is None:
            # Also check for 'evaluating' status decisions (same decision, progressed)
            decisions = await memory.list_decisions(ctx.user_id, domain=domain, status="evaluating")
            decision_id = decisions[0]["id"] if decisions else None

        if decision_id is None:
            # Create new decision context
            result = await memory.create_decision(
                ctx.user_id, domain=domain,
                decision_type="secondary_school_selection",
                title=ctx.raw_message[:60],
            )
            decision_id = result["id"]

        # Add school entities as candidates
        for school in entities:
            await memory.add_decision_entity(
                decision_id, "school", school, role="candidate",
            )

        # Sync decision factors from recalled profile/preferences
        district = anchor.get("context_data", {}).get("district", "")
        budget = anchor.get("context_data", {}).get("budget", "")
        child_age = anchor.get("context_data", {}).get("child_age", "")

        if district:
            await memory.add_decision_factor(
                decision_id, "district",
                {"preferred": district}, weight=0.3, source="user",
            )
        if budget:
            await memory.add_decision_factor(
                decision_id, "budget",
                {"max_hkd": budget}, weight=0.3, source="user",
            )
        if child_age:
            await memory.add_decision_factor(
                decision_id, "child_age",
                {"age": child_age}, weight=0.2, source="user",
            )
