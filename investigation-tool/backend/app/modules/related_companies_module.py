from __future__ import annotations

from app.models.schemas import InvestigationContext
from app.modules.base import BaseInvestigationModule


class RelatedCompaniesModule(BaseInvestigationModule):
    module_id = "related_companies_module"
    module_name = "关联企业查询"

    async def run(self, context: InvestigationContext) -> InvestigationContext:
        context.related_companies = [
            {
                "summary": "待接入关联企业、任职、持股查询",
                "status": "待核实",
            }
        ]
        context.add_log(self.module_id, "已生成关联企业模块占位结果")
        return context
