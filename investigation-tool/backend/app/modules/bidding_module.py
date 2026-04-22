from __future__ import annotations

from app.models.schemas import InvestigationContext
from app.modules.base import BaseInvestigationModule
from app.services.qichacha_service import QichachaService


class BiddingModule(BaseInvestigationModule):
    module_id = "bidding_module"
    module_name = "招投标查询"

    def __init__(self) -> None:
        self.qichacha = QichachaService()

    def should_run(self, context: InvestigationContext) -> bool:
        return context.include_bidding

    async def run(self, context: InvestigationContext) -> InvestigationContext:
        if context.subject_type != "company":
            context.bidding_records = [{"summary": "当前仅支持企业查询"}]
            context.add_log(self.module_id, "招投标查询跳过：仅支持企业")
            return context

        result = await self.qichacha.query_bidding_info(context.subject_name, context.subject_type)
        if result.get("success"):
            parsed = result["parsed_data"]
            context.bidding_records = parsed.get("records", [])
            context.add_log(self.module_id, f"已查询企查查招投标: {parsed.get('summary', '')}")
        else:
            context.bidding_records = [{"summary": f"企查查查询失败: {result.get('error', '未知错误')}"}]
            context.add_log(self.module_id, f"企查查招投标查询失败: {result.get('error')}")

        return context
