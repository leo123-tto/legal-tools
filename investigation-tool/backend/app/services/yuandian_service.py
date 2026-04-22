from __future__ import annotations

import httpx
import os
from typing import Any

from app.services.key_pool import KeyPool


def _sync_get(url: str, params: dict, headers: dict, timeout: float) -> httpx.Response:
    """同步 GET，在 async 方法中调用。"""
    with httpx.Client(trust_env=False, timeout=timeout) as client:
        return client.get(url, params=params, headers=headers)


class YuandianService:
    """元典 API 服务，调用 open.chineselaw.com 获取企业/案例详情。"""

    def __init__(self) -> None:
        raw_keys = os.getenv("YUANDIAN_API_KEYS", os.getenv("YUANDIAN_API_KEY", ""))
        self.pool = KeyPool(raw_keys) if raw_keys else None
        self.timeout = 30.0

    def _headers(self) -> dict[str, str]:
        return {
            "X-API-Key": self.pool.current(),
            "Accept": "application/json",
        }

    def _is_quota_error(self, status_code: int, data: dict) -> bool:
        if status_code == 429:
            return True
        msg = str(data.get("message", "")).lower()
        return "积分" in msg or "quota" in msg or "limit" in msg

    def _get_with_retry(self, url: str, params: dict[str, str]) -> tuple[httpx.Response, str | None]:
        """失败时自动换 Key 重试，返回 (response, error_msg)。"""
        if not self.pool or self.pool.is_empty:
            raise ValueError("未配置元典 API Key")

        last_error = ""
        for _ in range(len(self.pool)):
            try:
                resp = _sync_get(url, params, self._headers(), self.timeout)
                data = resp.json()
                if self._is_quota_error(resp.status_code, data):
                    last_error = data.get("message", "积分不足")
                    self.pool.rotate()
                    continue
                return resp, None
            except httpx.TimeoutException:
                raise RuntimeError("元典API查询超时")
            except Exception as exc:
                raise RuntimeError(str(exc))
        raise RuntimeError(f"所有元典 Key 均失败：{last_error}")

    async def query_company_detail(self, company_id: str | None = None, credit_code: str | None = None) -> dict[str, Any]:
        """查询企业详情。"""
        if not company_id and not credit_code:
            return {
                "success": False,
                "error": "company_id 和 credit_code 至少需要提供一个",
            }

        params: dict[str, str] = {}
        if company_id:
            params["id"] = company_id
        if credit_code:
            params["tyshxydm"] = credit_code

        try:
            resp, _ = self._get_with_retry("https://open.chineselaw.com/open/rh_company_detail", params)
        except RuntimeError as exc:
            return {"success": False, "error": str(exc)}

        data = resp.json()
        if data.get("code") == 404:
            return {"success": True, "found": False, "parsed_data": None}
        if data.get("code") != 200:
            return {"success": False, "error": data.get("message", "未知错误")}

        return {
            "success": True,
            "found": True,
            "raw_output": resp.text,
            "parsed_data": data.get("data"),
        }

    async def deep_dive_case(
        self,
        case_id: str | None = None,
        case_number: str | None = None,
        case_type: str = "ptal",
    ) -> dict[str, Any]:
        """查询案例详情。"""
        if not case_id and not case_number:
            return {
                "success": False,
                "error": "case_id 和 case_number 至少需要提供一个",
            }
        if case_type not in ("ptal", "qwal"):
            return {
                "success": False,
                "error": f"不支持的type类型: {case_type}，请使用 ptal（普通案例）或 qwal（权威案例）",
            }

        params: dict[str, str] = {"type": case_type}
        if case_id:
            params["id"] = case_id
        if case_number:
            params["ah"] = case_number

        try:
            resp, _ = self._get_with_retry("https://open.chineselaw.com/open/rh_case_details", params)
        except RuntimeError as exc:
            return {"success": False, "error": str(exc)}

        data = resp.json()
        if data.get("code") != 200:
            return {"success": False, "error": data.get("message", "未知错误")}

        case_list = data.get("data")
        if case_list is None:
            return {"success": True, "raw_output": resp.text, "parsed_data": None, "found": False}
        if isinstance(case_list, list):
            return {
                "success": True,
                "raw_output": resp.text,
                "parsed_data": case_list[0] if case_list else None,
                "cases": case_list,
                "found": True,
            }
        return {"success": True, "raw_output": resp.text, "parsed_data": case_list, "found": True}
