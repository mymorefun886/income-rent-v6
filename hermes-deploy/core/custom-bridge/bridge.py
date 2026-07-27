#!/usr/bin/env python3
"""Custom Hermes Bridge Adapter — translates Studio bridge protocol to Hermes REST API.

Protocol: JSON-line over TCP socket (same wire format as upstream bridge).
- BFF sends: {"action": "chat", "message": "...", "session_id": "...", ...}\n
- We respond: {"ok": true, "response": "...", ...}\n

This replaces the upstream hermes_bridge.py which expects the Nous Research
Hermes Agent Python API. Instead we call our custom agent's REST endpoints.
"""

from __future__ import annotations

import json
import os
import socket
import sys
import threading
import time
import uuid
from typing import Any

import httpx

# ── Configuration ──────────────────────────────────────────────
AGENT_CHAT_URL = os.environ.get("AGENT_CHAT_URL", "http://hermes-agent:8000/agent/chat")
AGENT_SEARCH_URL = os.environ.get("AGENT_SEARCH_URL", "http://hermes-agent:8000/agent/search")
LISTEN_HOST = os.environ.get("BRIDGE_LISTEN_HOST", "0.0.0.0")
LISTEN_PORT = int(os.environ.get("BRIDGE_LISTEN_PORT", "18780"))
HTTP_TIMEOUT = float(os.environ.get("BRIDGE_HTTP_TIMEOUT", "120"))


class CustomBridge:
    """Minimal bridge that forwards chat requests to Hermes REST API."""

    def __init__(self) -> None:
        self._stop = threading.Event()
        self._results: dict[str, dict[str, Any]] = {}  # run_id → result
        self._client = httpx.Client(timeout=HTTP_TIMEOUT)

    # ── Request handler ───────────────────────────────────────

    def handle(self, req: dict[str, Any]) -> dict[str, Any]:
        action = str(req.get("action") or "").strip()

        if action == "ping":
            return {"pong": True, "time": time.time(), "pid": os.getpid()}

        if action == "chat":
            return self._handle_chat(req)

        if action == "get_result":
            return self._handle_get_result(req)

        if action == "get_output":
            return self._handle_get_output(req)

        if action == "status":
            return self._handle_status(req)

        if action == "get_history":
            return {"messages": [], "ok": True}

        if action == "interrupt":
            return {"ok": True, "interrupted": False}

        if action == "destroy":
            sid = str(req.get("session_id") or "")
            if sid:
                self._results = {k: v for k, v in self._results.items()
                                 if v.get("session_id") != sid}
            return {"ok": True}

        if action == "shutdown":
            self._stop.set()
            return {"status": "shutting_down", "ok": True}

        # Anything else → ok with empty result
        return {"ok": True, "unsupported_action": action}

    # ── Chat handler ──────────────────────────────────────────

    def _handle_chat(self, req: dict[str, Any]) -> dict[str, Any]:
        message = req.get("message", "") or req.get("input", "")
        session_id = str(req.get("session_id") or "").strip() or uuid.uuid4().hex
        user_id = req.get("profile") or req.get("user_id") or "default"
        instructions = req.get("instructions") or req.get("system_message") or ""

        # Build payload for our agent
        payload: dict[str, Any] = {
            "user_id": user_id,
            "message": message,
            "session_id": session_id,
            "source": "hermes-studio",
        }
        if instructions:
            payload["instructions"] = instructions

        try:
            resp = self._client.post(AGENT_CHAT_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            run_id = uuid.uuid4().hex
            self._results[run_id] = {
                "session_id": session_id,
                "response": f"Error: {exc}",
                "status": "error",
            }
            return {"run_id": run_id, "session_id": session_id, "status": "error",
                    "error": str(exc)}

        response_text = data.get("response", "") or data.get("text", "")
        run_id = data.get("task_id") or data.get("run_id") or uuid.uuid4().hex
        returned_session = data.get("session_id") or session_id

        self._results[run_id] = {
            "session_id": returned_session,
            "response": response_text,
            "status": "completed",
            "intent": data.get("intent", ""),
            "domain": data.get("domain", ""),
            "skill": data.get("skill", ""),
            "elapsed_ms": data.get("elapsed_ms", 0),
            "preferences_recalled": data.get("preferences_recalled", 0),
        }

        # When BFF passes wait=true, return the full result inline
        if req.get("wait"):
            return {
                "run_id": run_id,
                "session_id": returned_session,
                "status": "completed",
                "response": response_text,
            }

        return {"run_id": run_id, "session_id": returned_session, "status": "running"}

    # ── Result / output handlers ──────────────────────────────

    def _handle_get_result(self, req: dict[str, Any]) -> dict[str, Any]:
        run_id = str(req.get("run_id") or "")
        result = self._results.get(run_id)
        if not result:
            return {"ok": True, "status": "not_found"}
        return {
            "ok": True,
            "run_id": run_id,
            "session_id": result["session_id"],
            "status": result.get("status", "completed"),
            "response": result.get("response", ""),
        }

    def _handle_get_output(self, req: dict[str, Any]) -> dict[str, Any]:
        run_id = str(req.get("run_id") or "")
        cursor = int(req.get("cursor") or 0)
        event_cursor = int(req.get("event_cursor") or 0)
        result = self._results.get(run_id)
        if not result:
            return {"ok": True, "delta": "", "cursor": 0, "event_cursor": 0, "events": [], "done": True}

        response_text = result.get("response", "")
        if cursor >= len(response_text):
            return {"ok": True, "delta": "", "cursor": cursor, "event_cursor": event_cursor, "events": [], "done": True}

        # Return remaining text as one chunk (non-streaming)
        chunk = response_text[cursor:]
        new_cursor = len(response_text)
        done = result.get("status") == "completed"
        return {"ok": True, "delta": chunk, "cursor": new_cursor, "event_cursor": event_cursor, "events": [], "done": done}

    def _handle_status(self, req: dict[str, Any]) -> dict[str, Any]:
        sid = str(req.get("session_id") or "")
        # Find any run for this session
        for run_id, result in self._results.items():
            if result.get("session_id") == sid:
                return {
                    "ok": True,
                    "session_id": sid,
                    "status": result.get("status", "unknown"),
                }
        return {"ok": True, "session_id": sid, "status": "idle"}

    # ── TCP server ────────────────────────────────────────────

    def serve_forever(self) -> None:
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind((LISTEN_HOST, LISTEN_PORT))
        server.listen(16)
        server.settimeout(0.5)

        ready_msg = json.dumps({"event": "ready", "endpoint": f"tcp://{LISTEN_HOST}:{LISTEN_PORT}"})
        print(ready_msg, flush=True)

        while not self._stop.is_set():
            conn: socket.socket | None = None
            try:
                try:
                    conn, _addr = server.accept()
                except socket.timeout:
                    continue

                try:
                    req = self._read_request(conn)
                    data = self.handle(req)
                    resp: dict[str, Any] = {"ok": True, **data}
                except Exception as exc:
                    resp = {"ok": False, "error": str(exc), "error_type": type(exc).__name__}

                self._write_response(conn, resp)
            except Exception as exc:
                print(f"[custom-bridge] loop error: {exc}", file=sys.stderr, flush=True)
            finally:
                if conn:
                    try:
                        conn.close()
                    except OSError:
                        pass

        server.close()

    @staticmethod
    def _read_request(conn: socket.socket) -> dict[str, Any]:
        chunks: list[bytes] = []
        while True:
            chunk = conn.recv(65536)
            if not chunk:
                break
            chunks.append(chunk)
            if b"\n" in chunk:
                break
        if not chunks:
            raise RuntimeError("empty request")
        line = b"".join(chunks).split(b"\n", 1)[0].strip()
        if not line:
            raise RuntimeError("empty request")
        return json.loads(line.decode("utf-8"))

    @staticmethod
    def _write_response(conn: socket.socket, resp: dict[str, Any]) -> None:
        payload = (json.dumps(resp, default=str) + "\n").encode("utf-8")
        conn.sendall(payload)


def main() -> int:
    bridge = CustomBridge()
    print(f"[custom-bridge] listening on tcp://{LISTEN_HOST}:{LISTEN_PORT}", file=sys.stderr, flush=True)
    print(f"[custom-bridge] agent endpoint: {AGENT_CHAT_URL}", file=sys.stderr, flush=True)
    bridge.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
