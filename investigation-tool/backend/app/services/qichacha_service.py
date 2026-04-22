from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from app.services.key_pool import KeyPool

QCC_CONFIG_PATH = Path.home() / ".qcc" / "config.json"


def _write_qcc_config(token: str) -> None:
    """将 Bearer token 写入 qcc config 文件。"""
    config_path = QCC_CONFIG_PATH
    if config_path.exists():
        config = json.loads(config_path.read_text())
    else:
        config = {"version": "2.1", "mcp": {}}
    config["mcp"]["authorization"] = token
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(config, indent=2))


class QichachaService:
    """企查查 CLI 服务，通过 qcc-agent-cli 调用企查查数据。"""

    def __init__(self) -> None:
        self.cli_available = shutil.which("qcc") is not None
        raw_keys = os.getenv("QCC_AUTHORIZATIONS", "")
        self.pool = KeyPool(raw_keys) if raw_keys else None

    def _is_quota_error(self, stdout: str) -> bool:
        return "积分余额不足" in stdout or "积分不足" in stdout

    def _ensure_current_key(self) -> None:
        """确保 config 文件中的 token 与当前 pool key 一致。"""
        if not self.pool or self.pool.is_empty:
            return
        _write_qcc_config(self.pool.current())

    def _run_qcc(self, server: str, tool: str, search_key: str) -> dict[str, Any]:
        """执行 qcc CLI 命令，积分不足时自动换 Key 重试一次。"""
        if not self.cli_available:
            return {
                "success": False,
                "error": "企查查 CLI 未安装，请运行: npm install -g qcc-agent-cli",
            }

        for _ in range(len(self.pool) if self.pool and not self.pool.is_empty else 1):
            self._ensure_current_key()
            try:
                result = subprocess.run(
                    ["qcc", server, tool, "--searchKey", search_key],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if self._is_quota_error(result.stdout):
                    if self.pool and len(self.pool) > 1:
                        self.pool.rotate()
                        continue
                    return {"success": False, "error": "企查查积分余额不足"}
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
        return {"success": False, "error": "企查查积分余额不足，所有 Key 均已耗尽"}

    async def query_basic_info(self, subject_name: str, subject_type: str) -> dict[str, Any]:
        """查询企业基础信息：工商登记、股东、主要人员。"""
        if subject_type != "company":
            return {"success": False, "error": "当前仅支持企业查询"}

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

        shareholder_result = self._run_qcc("company", "get_shareholder_info", subject_name)
        shareholders = shareholder_result.get("data", {}) if shareholder_result.get("success") else {}

        personnel_result = self._run_qcc("company", "get_key_personnel", subject_name)
        personnel = personnel_result.get("data", {}) if personnel_result.get("success") else {}

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

        def run_and_summary(server: str, tool: str, label: str, key: str) -> tuple[dict, str]:
            r = self._run_qcc(server, tool, subject_name)
            if r.get("success"):
                count = r["data"].get("命中数量", 0) or 0
                msg = f"{label}：{count} 条" if count else f"{label}：未发现"
            else:
                msg = f"{label}：查询失败"
            return r, msg

        (dr, ds) = run_and_summary("risk", "get_dishonest_info", "失信记录", "dishonest")
        summary_parts.append(ds)
        (lr, ls) = run_and_summary("risk", "get_high_consumption_restriction", "限高消费", "limit")
        summary_parts.append(ls)
        (dor, dos) = run_and_summary("risk", "get_judgment_debtor_info", "被执行人", "debtor")
        summary_parts.append(dos)
        (docr, docos) = run_and_summary("risk", "get_judicial_documents", "裁判文书", "doc")
        summary_parts.append(docos)
        (pr, ps) = run_and_summary("risk", "get_administrative_penalty", "行政处罚", "penalty")
        summary_parts.append(ps)
        (er, es) = run_and_summary("risk", "get_business_exception", "经营异常", "exception")
        summary_parts.append(es)

        has_any_success = any(r.get("success") for r in [dr, lr, dor, docr, pr, er])
        if not has_any_success:
            first_error = next(
                (r.get("error") for r in [dr, lr, dor, docr, pr, er] if r.get("error")), "所有企查查风险查询均失败"
            )
            return {
                "success": False,
                "error": first_error,
                "parsed_data": {"summary": "；".join(summary_parts) if summary_parts else "企查查风险查询失败"},
            }

        return {
            "success": True,
            "raw_output": json.dumps(
                {k: v for k, (_, v) in zip(["dishonest", "limit", "debtor", "doc", "penalty", "exception"], [dr, lr, dor, docr, pr, er])},
                ensure_ascii=False,
            ),
            "parsed_data": {
                "summary": "；".join(summary_parts),
                "dishonest_info": dr.get("data", {}),
                "limit_consumption": lr.get("data", {}),
                "judgment_debtor": dor.get("data", {}),
                "judicial_documents": docr.get("data", {}),
                "admin_penalty": pr.get("data", {}),
                "business_exception": er.get("data", {}),
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
                "records": records[:20],
            },
        }
