from __future__ import annotations

from typing import Any


class ClaudeCodeProvider:
    provider_name = "claude_code"

    async def generate_report(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "success": False,
            "parsed_data": {},
            "raw_output": None,
            "error": "Claude Code provider 当前没有稳定的非交互式本地调用入口，暂未接通。",
        }
