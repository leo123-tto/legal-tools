from __future__ import annotations

import os

from app.services.lm_studio_provider import LmStudioProvider


class HermesProvider(LmStudioProvider):
    provider_name = "hermes"

    def __init__(self, base_url: str | None = None, model_name: str | None = None, timeout: float = 60.0) -> None:
        # Hermes API Server 默认端口 8642
        # 需要设置 API_SERVER_ENABLED=true 和 API_SERVER_KEY
        hermes_base_url = base_url or os.getenv("HERMES_BASE_URL") or "http://127.0.0.1:8642/v1"
        hermes_model = model_name or os.getenv("HERMES_MODEL") or os.getenv("REPORT_MODEL") or "hermes"
        super().__init__(base_url=hermes_base_url, model_name=hermes_model, timeout=timeout)
        self.api_key = os.getenv("HERMES_API_KEY") or os.getenv("API_SERVER_KEY") or ""

    async def _post_json(self, endpoint: str, body: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout, trust_env=False) as client:
            headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
            response = await client.post(endpoint, json=body, headers=headers)
        response.raise_for_status()
        return response.json()

    async def generate_report(self, payload: dict[str, object]) -> dict[str, object]:
        if not self.base_url:
            return {
                "success": False,
                "parsed_data": {},
                "raw_output": None,
                "error": "未配置 HERMES_BASE_URL，无法调用 Hermes provider。",
            }
        return await super().generate_report(payload)
