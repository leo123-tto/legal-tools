from __future__ import annotations

from app.models.schemas import InvestigationContext
from app.modules.base import BaseInvestigationModule


class AssetClueModule(BaseInvestigationModule):
    module_id = "asset_clue_module"
    module_name = "财产线索提炼"

    async def run(self, context: InvestigationContext) -> InvestigationContext:
        context.asset_clues = [
            {
                "summary": "待基于前序结果提炼财产线索",
                "status": "待核实",
            }
        ]
        context.add_log(self.module_id, "已生成财产线索模块占位结果")
        return context
