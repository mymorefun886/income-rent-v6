#!/usr/bin/env python3
"""OpenAI-Compatible API Proxy → Hermes Agent REST API.

Exposes POST /v1/chat/completions and GET /v1/models so Hermes Studio
can use its "custom" provider to talk to our Hermes Agent.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any, AsyncGenerator

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

app = FastAPI(title="Hermes Agent OpenAI Proxy", version="1.0.0")

AGENT_CHAT_URL = os.environ.get("AGENT_CHAT_URL", "http://hermes-agent:8000/agent/chat")
HTTP_TIMEOUT = float(os.environ.get("PROXY_HTTP_TIMEOUT", "120"))


@app.get("/health")
async def health():
    return {"status": "ok", "service": "hermes-agent-openai-proxy"}


@app.get("/v1/models")
async def list_models():
    """Return available models from our agent's perspective."""
    return {
        "object": "list",
        "data": [
            {
                "id": "hermes-agent",
                "object": "model",
                "created": int(time.time()),
                "owned_by": "hermes",
            }
        ],
    }


async def _stream_response(response_text: str, model: str) -> AsyncGenerator[str, None]:
    """Yield SSE chunks for a completed response text."""
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created = int(time.time())

    # First chunk: role announcement
    chunk0 = {
        "id": completion_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "delta": {"role": "assistant", "content": ""}, "finish_reason": None}],
    }
    yield f"data: {json.dumps(chunk0)}\n\n"

    # Stream content in word-sized chunks
    words = response_text.split(" ")
    for i, word in enumerate(words):
        content = word + (" " if i < len(words) - 1 else "")
        chunk = {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {"content": content}, "finish_reason": None}],
        }
        yield f"data: {json.dumps(chunk)}\n\n"

    # Final chunk with finish_reason
    final_chunk = {
        "id": completion_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
    }
    yield f"data: {json.dumps(final_chunk)}\n\n"
    yield "data: [DONE]\n\n"


@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    """Translate OpenAI chat completions request to Hermes Agent format."""
    body = await request.json()

    # Extract the last user message
    messages: list[dict] = body.get("messages", [])
    user_messages = [m for m in messages if m.get("role") == "user"]
    if not user_messages:
        return JSONResponse(
            status_code=400,
            content={"error": {"message": "No user message found", "type": "invalid_request_error"}},
        )

    last_user_msg = user_messages[-1].get("content", "")
    if isinstance(last_user_msg, list):
        # Multimodal content — extract text parts
        text_parts = [p.get("text", "") for p in last_user_msg if p.get("type") == "text"]
        last_user_msg = "\n".join(text_parts)

    # Build Hermes Agent payload
    session_id = body.get("user") or body.get("session_id") or str(uuid.uuid4().hex)[:8]
    user_id = body.get("user") or "default"

    payload: dict[str, Any] = {
        "user_id": user_id,
        "message": last_user_msg,
        "session_id": session_id,
        "source": "hermes-studio-openai-proxy",
    }

    # Call Hermes Agent
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.post(AGENT_CHAT_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={
                "error": {
                    "message": f"Agent request failed: {exc}",
                    "type": "api_error",
                }
            },
        )

    response_text = data.get("response", "") or data.get("text", "")
    model = body.get("model", "hermes-agent")

    # Streaming path
    if body.get("stream"):
        return StreamingResponse(
            _stream_response(response_text, model),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
        )

    # Non-streaming path
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    return {
        "id": completion_id,
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_text,
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        },
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "18781"))
    uvicorn.run(app, host="0.0.0.0", port=port)
