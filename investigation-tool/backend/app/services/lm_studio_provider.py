from __future__ import annotations

import os
import re
from typing import Any

import httpx


class LmStudioProvider:
    provider_name = "lm_studio"

    def __init__(self, base_url: str | None = None, model_name: str | None = None, timeout: float = 60.0) -> None:
        raw_base_url = base_url if base_url is not None else os.getenv("LM_STUDIO_BASE_URL", "http://127.0.0.1:1234/v1")
        self.base_url = self._normalize_base_url(raw_base_url)
        self.model_name = model_name or os.getenv("REPORT_MODEL") or os.getenv("LM_STUDIO_MODEL") or "gemma-4-26b-a4b-it"
        self.timeout = timeout

    def _normalize_base_url(self, base_url: str) -> str:
        base = base_url.strip().rstrip("/")
        if not base:
            return ""
        if ":1]" in base:
            return "http://127.0.0.1:1234/v1"
        return base

    def _build_messages(self, payload: dict[str, Any]) -> list[dict[str, str]]:
        return [
            {
                "role": "system",
                "content": (
                    "你是执行背景调查报告生成助手。"
                    "只能根据传入结构化数据写报告，不允许编造事实。"
                    "对不明确的信息标记为待核实，对缺失信息标记为未查询到。"
                    "只输出最终 Markdown 报告，不要输出思考过程、标签、解释或额外前言。"
                    "任务状态以输入数据为准，不要自行改写状态。"
                ),
            },
            {
                "role": "user",
                "content": (
                    "请根据以下结构化调查结果生成 Markdown 报告。"
                    "要求：\n"
                    "1. 第一行必须是 # 执行背景调查报告\n"
                    "2. 明确写出任务ID、调查主体、主体类型、调查范围、当前状态\n"
                    "3. 各模块只引用输入中的真实字段\n"
                    "4. 不要输出 <|channel>、thought、analysis、``` 等内容\n"
                    f"5. 输入数据如下：\n{payload}"
                ),
            },
        ]

    def _clean_report(self, content: str) -> str:
        cleaned = content.strip()
        cleaned = re.sub(r"<\|channel\|>.*?<\|/channel\|>", "", cleaned, flags=re.DOTALL)
        cleaned = re.sub(r"<\|start\|>assistant<\|message\|>", "", cleaned)
        cleaned = re.sub(r"```(?:markdown)?", "", cleaned)
        lines: list[str] = []
        for line in cleaned.splitlines():
            stripped = line.strip()
            lower = stripped.lower()
            if not stripped:
                lines.append("")
                continue
            if lower.startswith("thought") or lower.startswith("analysis"):
                continue
            if "<|channel|>" in stripped or "<channel|>" in stripped:
                continue
            lines.append(line)
        cleaned = "\n".join(lines).strip()
        if not cleaned.startswith("# "):
            cleaned = f"# 执行背景调查报告\n\n{cleaned}".strip()
        return cleaned

    async def _post_json(self, endpoint: str, body: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout, trust_env=False) as client:
            response = await client.post(endpoint, json=body)
        response.raise_for_status()
        return response.json()

    async def generate_report(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.base_url:
            return {
                "success": False,
                "parsed_data": {},
                "raw_output": None,
                "error": "未配置 LM_STUDIO_BASE_URL，无法调用 lm_studio provider。",
            }
        endpoint = f"{self.base_url}/chat/completions"
        messages = self._build_messages(payload)
        try:
            data = await self._post_json(
                endpoint,
                {
                    "model": self.model_name,
                    "messages": messages,
                    "temperature": 0.2,
                },
            )
            content = self._clean_report(data["choices"][0]["message"]["content"])
            return {"success": True, "parsed_data": {"report": content}, "raw_output": data, "error": None}
        except Exception as exc:
            return {"success": False, "parsed_data": {}, "raw_output": None, "error": str(exc)}
