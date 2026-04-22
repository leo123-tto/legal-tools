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
        """判断是否为统一社会信用代码（18位字母数字）"""
        return bool(re.match(r"^[A-Z0-9]{18}$", text.upper()))

    async def run(self, context: InvestigationContext) -> InvestigationContext:
        if context.subject_type != "company":
            context.basic_info = {
                "summary": "当前仅支持企业查询",
                "status": "不支持",
            }
            context.add_log(self.module_id, "基础信息查询跳过：仅支持企业")
            return context

        # 先尝试企查查
        qcc_result = await self.qichacha.query_basic_info(context.subject_name, context.subject_type)
        if qcc_result.get("success"):
            context.basic_info = qcc_result["parsed_data"]
            context.add_log(self.module_id, f"已查询企查查基础信息: {context.basic_info.get('summary', '')[:50]}")
            return context

        # 企查查失败时，用元典（仅支持统一社会信用代码查询）
        if self._is_credit_code(context.subject_name):
            yd_result = await self.yuandian.query_company_detail(credit_code=context.subject_name)
            if yd_result.get("found"):
                data = yd_result["parsed_data"]
                summary_parts = [
                    f"公司名称：{data.get('企业名称', '')}",
                    f"法定代表人：{data.get('法定代表人', '')}",
                    f"注册资本：{data.get('注册资本', '')}",
                    f"成立日期：{data.get('成立日期', '')}",
                    f"经营状态：{data.get('经营状态', '')}",
                ]
                context.basic_info = {
                    "summary": "；".join(filter(None, summary_parts)),
                    "registration": data,
                    "shareholders": data.get("股东详情", []),
                    "change_records": data.get("变更", []),
                }
                context.add_log(self.module_id, f"已查询元典基础信息: {data.get('企业名称', '')}")
                return context

        # 两者都失败
        context.basic_info = {
            "summary": f"企查查查询失败: {qcc_result.get('error', '未知错误')}",
            "status": "查询失败",
        }
        context.add_log(self.module_id, f"企查查基础信息查询失败: {qcc_result.get('error')}")
        return context
