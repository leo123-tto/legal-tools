from __future__ import annotations

import httpx
import os
from typing import Any


class YuandianService:
    """元典 API 服务，调用 open.chineselaw.com 获取企业/案例详情。"""

    def __init__(self) -> None:
        self.api_key = os.getenv("YUANDIAN_API_KEY", "")
        self.timeout = 30.0

    async def query_company_detail(self, company_id: str | None = None, credit_code: str | None = None) -> dict[str, Any]:
        """
        查询企业详情。

        Args:
            company_id: 企业 ID（ES 文档 _id）
            credit_code: 统一社会信用代码
        """
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
            async with httpx.AsyncClient(timeout=self.timeout, trust_env=False) as client:
                response = await client.get(
                    "https://open.chineselaw.com/open/rh_company_detail",
                    params=params,
                    headers={
                        "X-API-Key": self.api_key,
                        "Accept": "application/json",
                    },
                )
                data = response.json()
                if data.get("code") == 404:
                    return {
                        "success": True,
                        "found": False,
                        "parsed_data": None,
                    }
                if data.get("code") != 200:
                    return {
                        "success": False,
                        "error": data.get("message", "未知错误"),
                    }

                company_data = data.get("data")
                return {
                    "success": True,
                    "found": True,
                    "raw_output": response.text,
                    "parsed_data": company_data,
                }
        except httpx.TimeoutException:
            return {"success": False, "error": "元典API查询超时"}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def deep_dive_case(
        self,
        case_id: str | None = None,
        case_number: str | None = None,
        case_type: str = "ptal",
    ) -> dict[str, Any]:
        """
        查询案例详情。

        Args:
            case_id: 案例标识
            case_number: 案号 (ah)
            case_type: ptal（普通案例）或 qwal（权威案例）
        """
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
            async with httpx.AsyncClient(timeout=self.timeout, trust_env=False) as client:
                response = await client.get(
                    "https://open.chineselaw.com/open/rh_case_details",
                    params=params,
                    headers={
                        "X-API-Key": self.api_key,
                        "Accept": "application/json",
                    },
                )
                if response.status_code != 200:
                    return {
                        "success": False,
                        "error": f"元典API请求失败: HTTP {response.status_code}",
                    }

                data = response.json()
                if data.get("code") != 200:
                    return {
                        "success": False,
                        "error": data.get("message", "未知错误"),
                    }

                case_list = data.get("data")
                if case_list is None:
                    return {
                        "success": True,
                        "raw_output": response.text,
                        "parsed_data": None,
                        "found": False,
                    }
                if isinstance(case_list, list):
                    return {
                        "success": True,
                        "raw_output": response.text,
                        "parsed_data": case_list[0] if case_list else None,
                        "cases": case_list,
                        "found": True,
                    }
                return {
                    "success": True,
                    "raw_output": response.text,
                    "parsed_data": case_list,
                    "found": True,
                }
        except httpx.TimeoutException:
            return {"success": False, "error": "元典API查询超时"}
        except Exception as exc:
            return {"success": False, "error": str(exc)}
