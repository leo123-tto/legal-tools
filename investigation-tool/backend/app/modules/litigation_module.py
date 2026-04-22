from __future__ import annotations

from app.models.schemas import InvestigationContext
from app.modules.base import BaseInvestigationModule


class LitigationModule(BaseInvestigationModule):
    module_id = "litigation_module"
    module_name = "涉诉案件查询"

    async def run(self, context: InvestigationContext) -> InvestigationContext:
        context.litigation_cases = [
            {
                "time_range": context.time_range,
                "summary": "待接入近年涉诉案件查询",
                "status": "待核实",
            }
        ]
        context.add_log(self.module_id, "已生成涉诉案件模块占位结果")
        return context
