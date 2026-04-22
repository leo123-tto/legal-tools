from __future__ import annotations

import re

from app.models.schemas import InvestigationContext
from app.modules.base import BaseInvestigationModule
from app.services.qichacha_service import QichachaService
from app.services.yuandian_service import YuandianService


class BasicInfoModule(BaseInvestigationModule):
    module_id = "basic_info_module"
    module_name = "基础信息查询"

    def __init__(self) -> None:
        self.qichacha = QichachaService()
        self.yuandian = YuandianService()

    def _is_credit_code(self, text: str) -> bool:
        return bool(re.match(r"^[A-Z0-9]{18}$", text.upper()))

    def _build_summary(self, data: dict) -> str:
        parts = []
        for key, label in [
            ("公司名称", "公司名称"),
            ("企业名称", "公司名称"),
            ("法定代表人", "法定代表人"),
            ("legal_representative", "法定代表人"),
            ("注册资本", "注册资本"),
            ("reg_capital", "注册资本"),
            ("成立日期", "成立日期"),
            ("establish_date", "成立日期"),
            ("登记状态", "登记状态"),
            ("经营状态", "经营状态"),
            ("operating_status", "经营状态"),
        ]:
            val = data.get(key) or data.get(label, "")
            if val:
                parts.append(f"{label}：{val}")
        return "；".join(parts) if parts else "未查询到有效信息"

    async def run(self, context: InvestigationContext) -> InvestigationContext:
        if context.subject_type != "company":
            context.basic_info = {
                "summary": "当前仅支持企业查询",
                "status": "不支持",
            }
            context.add_log(self.module_id, "基础信息查询跳过：仅支持企业")
            return context

        # --- 路径1：有信用代码 → 元典为主，可选企查查补充 ---
        if context.credit_code and self._is_credit_code(context.credit_code):
            yd_result = await self.yuandian.query_company_detail(credit_code=context.credit_code)
            if yd_result.get("found"):
                data = yd_result["parsed_data"]
                context.basic_info = {
                    "summary": self._build_summary(data),
                    "registration": data,
                    "shareholders": data.get("股东详情", []),
                    "change_records": data.get("变更", []),
                }
                context.add_log(self.module_id, f"已通过信用代码查询元典: {data.get('企业名称', '')}")

                # 可选：企查查补充查询
                if context.supplement_qichacha:
                    supplement_name = (
                        data.get("企业名称") or data.get("公司名称") or context.subject_name
                    )
                    qcc_result = await self.qichacha.query_basic_info(supplement_name, "company")
                    if qcc_result.get("success"):
                        qcc_data = qcc_result["parsed_data"]
                        context.basic_info["summary"] = self._build_summary(qcc_data.get("registration", {}))
                        # Qichacha 数据更丰富，补充进去
                        context.basic_info["registration"] = qcc_data.get("registration", context.basic_info["registration"])
                        context.basic_info["shareholders"] = qcc_data.get("shareholders") or context.basic_info["shareholders"]
                        context.basic_info["key_personnel"] = qcc_data.get("key_personnel", {})
                        context.basic_info["change_records"] = qcc_data.get("change_records") or context.basic_info["change_records"]
                        context.add_log(self.module_id, f"企查查补充完成: {supplement_name}")
                    else:
                        context.add_log(self.module_id, f"企查查补充失败（不影响结果）: {qcc_result.get('error')}")
                return context
            else:
                context.add_log(self.module_id, f"元典信用代码查询失败: {yd_result.get('error', '')}，尝试企查查")

        # --- 路径2：名称查询 → 企查查为主，元典备选 ---
        qcc_result = await self.qichacha.query_basic_info(context.subject_name, context.subject_type)
        if qcc_result.get("success"):
            qcc_data = qcc_result["parsed_data"]
            context.basic_info = {
                "summary": self._build_summary(qcc_data.get("registration", {})),
                "registration": qcc_data.get("registration", {}),
                "shareholders": qcc_data.get("shareholders", []),
                "key_personnel": qcc_data.get("key_personnel", {}),
                "change_records": qcc_data.get("change_records", []),
            }
            context.add_log(self.module_id, f"已查询企查查: {context.basic_info.get('summary', '')[:50]}")
            return context

        # --- 路径2备选：企查查失败，尝试元典（仅当输入本身是信用代码）---
        if self._is_credit_code(context.subject_name):
            yd_result = await self.yuandian.query_company_detail(credit_code=context.subject_name)
            if yd_result.get("found"):
                data = yd_result["parsed_data"]
                context.basic_info = {
                    "summary": self._build_summary(data),
                    "registration": data,
                    "shareholders": data.get("股东详情", []),
                    "change_records": data.get("变更", []),
                }
                context.add_log(self.module_id, f"企查查失败，已通过名称查询元典: {data.get('企业名称', '')}")
                return context

        # --- 全部失败 ---
        context.basic_info = {
            "summary": f"企查查查询失败: {qcc_result.get('error', '未知错误')}",
            "status": "查询失败",
        }
        context.add_log(self.module_id, f"基础信息查询失败: {qcc_result.get('error')}")
        return context
