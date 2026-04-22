from __future__ import annotations

import os
from typing import Any

from app.services.cloud_provider import CloudProvider
from app.services.claude_code_provider import ClaudeCodeProvider
from app.services.hermes_provider import HermesProvider
from app.services.lm_studio_provider import LmStudioProvider
from app.services.report_provider import ReportProvider


def get_report_provider() -> ReportProvider:
    provider_name = os.getenv("REPORT_PROVIDER", "lm_studio").strip().lower() or "lm_studio"

    if provider_name == "lm_studio":
        return LmStudioProvider()
    if provider_name == "hermes":
        return HermesProvider()
    if provider_name == "claude_code":
        return ClaudeCodeProvider()
    if provider_name == "cloud":
        return CloudProvider()

    return UnsupportedProvider(provider_name)


class UnsupportedProvider:
    def __init__(self, provider_name: str) -> None:
        self.provider_name = provider_name

    async def generate_report(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "success": False,
            "parsed_data": {},
            "raw_output": None,
            "error": f"不支持的 REPORT_PROVIDER：{self.provider_name}",
        }
