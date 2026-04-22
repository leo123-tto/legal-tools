from __future__ import annotations

from app.models.schemas import InvestigationContext
from app.modules.base import BaseInvestigationModule
from app.services.qichacha_service import QichachaService


class RestrictionModule(BaseInvestigationModule):
    module_id = "restriction_module"
    module_name = "失信限高查询"

    def __init__(self) -> None:
        self.qichacha = QichachaService()

    async def run(self, context: InvestigationContext) -> InvestigationContext:
        if context.subject_type != "company":
            context.restriction_info = {
                "summary": "当前仅支持企业查询",
            }
            context.add_log(self.module_id, "失信限高查询跳过：仅支持企业")
            return context

        result = await self.qichacha.query_restriction_info(context.subject_name, context.subject_type)
        if result.get("success"):
            parsed = result["parsed_data"]
            context.restriction_info = parsed
            context.add_log(self.module_id, f"已查询企查查风险信息: {parsed.get('summary', '')[:50]}")
        else:
            context.restriction_info = {
                "summary": f"企查查查询失败: {result.get('error', '未知错误')}",
            }
            context.add_log(self.module_id, f"企查查风险查询失败: {result.get('error')}")

        return context
