from __future__ import annotations

from app.models.schemas import InvestigationContext
from app.modules.base import BaseInvestigationModule


class KeyCaseFilterModule(BaseInvestigationModule):
    module_id = "key_case_filter_module"
    module_name = "重点案件识别"

    async def run(self, context: InvestigationContext) -> InvestigationContext:
        if context.litigation_cases:
            context.key_cases_for_review = [
                {
                    "summary": "待根据涉诉案件筛选重点案件",
                    "status": "待核实",
                }
            ]
        else:
            context.key_cases_for_review = [
                {
                    "summary": "未查询到可识别的涉诉案件",
                    "status": "未查询到",
                }
            ]
        context.add_log(self.module_id, "已生成重点案件识别模块占位结果")
        return context
