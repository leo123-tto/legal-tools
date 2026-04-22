from __future__ import annotations

import os
from typing import Any

import httpx

from app.services.lm_studio_provider import LmStudioProvider


class CloudProvider(LmStudioProvider):
    provider_name = "cloud"

    def __init__(self, base_url: str | None = None, model_name: str | None = None, timeout: float = 60.0) -> None:
        cloud_base_url = base_url or os.getenv("CLOUD_API_BASE_URL") or ""
        cloud_model = model_name or os.getenv("REPORT_MODEL") or os.getenv("CLOUD_MODEL") or ""
        self.api_key = os.getenv("CLOUD_API_KEY") or ""
        super().__init__(base_url=cloud_base_url, model_name=cloud_model, timeout=timeout)

    async def generate_report(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.base_url:
            return {
                "success": False,
                "parsed_data": {},
                "raw_output": None,
                "error": "未配置 CLOUD_API_BASE_URL，无法调用 cloud provider。",
            }
        if not self.api_key:
            return {
                "success": False,
                "parsed_data": {},
                "raw_output": None,
                "error": "未配置 CLOUD_API_KEY，无法调用 cloud provider。",
            }
        if not self.model_name:
            return {
                "success": False,
                "parsed_data": {},
                "raw_output": None,
                "error": "未配置 REPORT_MODEL 或 CLOUD_MODEL，无法调用 cloud provider。",
            }
        return await super().generate_report(payload)

    async def _post_json(self, endpoint: str, body: dict[str, Any]) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(timeout=self.timeout, trust_env=False) as client:
            response = await client.post(endpoint, json=body, headers=headers)
        response.raise_for_status()
        return response.json()
