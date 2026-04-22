from __future__ import annotations

import json
import shutil
import subprocess
from typing import Any


class QichachaService:
    """企查查 CLI 服务，通过 qcc-agent-cli 调用企查查数据。"""

    def __init__(self) -> None:
        self.cli_available = shutil.which("qcc") is not None

    def _run_qcc(self, server: str, tool: str, search_key: str) -> dict[str, Any]:
        """执行 qcc CLI 命令，返回 JSON 结果。"""
        if not self.cli_available:
            return {
                "success": False,
                "error": "企查查 CLI 未安装，请运行: npm install -g qcc-agent-cli",
            }
        try:
            result = subprocess.run(
                ["qcc", server, tool, "--searchKey", search_key],
                capture_output=True,
                text=True,
                timeout=30,
            )
            # 企查查 CLI 返回纯文本错误信息（非 JSON）
            if "积分余额不足" in result.stdout:
                return {"success": False, "error": "企查查积分余额不足，请充值后使用"}
            if "无匹配项" in result.stdout or "error" in result.stdout.lower():
                return {"success": False, "error": result.stdout.strip()}
            if result.returncode != 0:
                return {"success": False, "error": result.stderr.strip()}
            return {"success": True, "data": json.loads(result.stdout)}
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "企查查查询超时"}
        except json.JSONDecodeError:
            return {"success": False, "error": f"企查查返回数据解析失败: {result.stdout[:200]}"}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def query_basic_info(self, subject_name: str, subject_type: str) -> dict[str, Any]:
        """查询企业基础信息：工商登记、股东、主要人员。"""
        if subject_type != "company":
            return {"success": False, "error": "当前仅支持企业查询"}

        # 工商登记信息
        reg_result = self._run_qcc("company", "get_company_registration_info", subject_name)
        if not reg_result.get("success"):
            return reg_result

        data = reg_result["data"]
        summary_parts = []
        if company_name := data.get("公司名称"):
            summary_parts.append(f"公司名称：{company_name}")
        if legal_person := data.get("法定代表人"):
            summary_parts.append(f"法定代表人：{legal_person}")
        if reg_capital := data.get("注册资本"):
            summary_parts.append(f"注册资本：{reg_capital}")
        if establish_date := data.get("成立日期"):
            summary_parts.append(f"成立日期：{establish_date}")
        if reg_status := data.get("登记状态"):
            summary_parts.append(f"登记状态：{reg_status}")
        if business_scope := data.get("经营范围"):
            summary_parts.append(f"经营范围：{business_scope[:100]}")

        summary = "；".join(summary_parts) if summary_parts else "未查询到有效信息"

        # 股东信息
        shareholder_result = self._run_qcc("company", "get_shareholder_info", subject_name)
        shareholders = shareholder_result.get("data", {}) if shareholder_result.get("success") else {}

        # 主要人员
        personnel_result = self._run_qcc("company", "get_key_personnel", subject_name)
        personnel = personnel_result.get("data", {}) if personnel_result.get("success") else {}

        # 变更记录
        changes_result = self._run_qcc("company", "get_change_records", subject_name)
        changes = changes_result.get("data", {}) if changes_result.get("success") else {}

        return {
            "success": True,
            "raw_output": json.dumps(data, ensure_ascii=False),
            "parsed_data": {
                "summary": summary,
                "registration": data,
                "shareholders": shareholders,
                "key_personnel": personnel,
                "change_records": changes,
            },
        }

    async def query_restriction_info(self, subject_name: str, subject_type: str) -> dict[str, Any]:
        """查询企业风险信息：失信、限高、被执行等。"""
        if subject_type != "company":
            return {"success": False, "error": "当前仅支持企业查询"}

        summary_parts = []

        # 失信信息
        dishonest_result = self._run_qcc("risk", "get_dishonest_info", subject_name)
        if dishonest_result.get("success"):
            dishonest_data = dishonest_result["data"]
            if hit_count := dishonest_data.get("命中数量", 0) or 0:
                summary_parts.append(f"失信记录：{hit_count} 条")
            else:
                summary_parts.append("失信记录：未发现")
        else:
            summary_parts.append("失信记录：查询失败")

        # 限高消费
        limit_result = self._run_qcc("risk", "get_high_consumption_restriction", subject_name)
        if limit_result.get("success"):
            limit_data = limit_result["data"]
            if hit_count := limit_data.get("命中数量", 0) or 0:
                summary_parts.append(f"限高消费：{hit_count} 条")
            else:
                summary_parts.append("限高消费：未发现")
        else:
            summary_parts.append("限高消费：查询失败")

        # 被执行人
        debtor_result = self._run_qcc("risk", "get_judgment_debtor_info", subject_name)
        if debtor_result.get("success"):
            debtor_data = debtor_result["data"]
            if hit_count := debtor_data.get("命中数量", 0) or 0:
                summary_parts.append(f"被执行人：{hit_count} 条")
            else:
                summary_parts.append("被执行人：未发现")
        else:
            summary_parts.append("被执行人：查询失败")

        # 裁判文书
        doc_result = self._run_qcc("risk", "get_judicial_documents", subject_name)
        if doc_result.get("success"):
            doc_data = doc_result["data"]
            if hit_count := doc_data.get("命中数量", 0) or 0:
                summary_parts.append(f"裁判文书：{hit_count} 份")
            else:
                summary_parts.append("裁判文书：未发现")
        else:
            summary_parts.append("裁判文书：查询失败")

        # 行政处罚
        penalty_result = self._run_qcc("risk", "get_administrative_penalty", subject_name)
        if penalty_result.get("success"):
            penalty_data = penalty_result["data"]
            if hit_count := penalty_data.get("命中数量", 0) or 0:
                summary_parts.append(f"行政处罚：{hit_count} 条")
            else:
                summary_parts.append("行政处罚：未发现")
        else:
            summary_parts.append("行政处罚：查询失败")

        # 经营异常
        exception_result = self._run_qcc("risk", "get_business_exception", subject_name)
        if exception_result.get("success"):
            exception_data = exception_result["data"]
            if hit_count := exception_data.get("命中数量", 0) or 0:
                summary_parts.append(f"经营异常：{hit_count} 条")
            else:
                summary_parts.append("经营异常：未发现")
        else:
            summary_parts.append("经营异常：查询失败")

        has_any_success = (
            dishonest_result.get("success", False)
            or limit_result.get("success", False)
            or debtor_result.get("success", False)
            or doc_result.get("success", False)
            or penalty_result.get("success", False)
            or exception_result.get("success", False)
        )

        if not has_any_success:
            first_error = (
                dishonest_result.get("error")
                or limit_result.get("error")
                or debtor_result.get("error")
                or doc_result.get("error")
                or penalty_result.get("error")
                or exception_result.get("error")
                or "所有企查查风险查询均失败"
            )
            return {
                "success": False,
                "error": first_error,
                "parsed_data": {
                    "summary": "；".join(summary_parts) if summary_parts else "企查查风险查询失败",
                },
            }

        summary = "；".join(summary_parts) if summary_parts else "未查询到风险信息"

        return {
            "success": True,
            "raw_output": json.dumps(
                {
                    "dishonest": dishonest_result.get("data", {}),
                    "limit_consumption": limit_result.get("data", {}),
                    "judgment_debtor": debtor_result.get("data", {}),
                    "judicial_documents": doc_result.get("data", {}),
                    "admin_penalty": penalty_result.get("data", {}),
                    "business_exception": exception_result.get("data", {}),
                },
                ensure_ascii=False,
            ),
            "parsed_data": {
                "summary": summary,
                "dishonest_info": dishonest_result.get("data", {}),
                "limit_consumption": limit_result.get("data", {}),
                "judgment_debtor": debtor_result.get("data", {}),
                "judicial_documents": doc_result.get("data", {}),
                "admin_penalty": penalty_result.get("data", {}),
                "business_exception": exception_result.get("data", {}),
            },
        }

    async def query_bidding_info(self, subject_name: str, subject_type: str) -> dict[str, Any]:
        """查询企业招投标信息。"""
        if subject_type != "company":
            return {"success": False, "error": "当前仅支持企业查询"}

        result = self._run_qcc("operation", "get_bidding_info", subject_name)
        if not result.get("success"):
            return result

        data = result["data"]
        records = data.get("招标信息", []) or data.get("中标信息", []) or []
        if isinstance(records, dict):
            records = [records] if records else []
        count = len(records) if records else 0

        return {
            "success": True,
            "raw_output": json.dumps(data, ensure_ascii=False),
            "parsed_data": {
                "summary": f"招投标记录：{count} 条" if count > 0 else "招投标记录：未发现",
                "records": records[:20],  # 最多返回20条
            },
        }
