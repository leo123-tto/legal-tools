from __future__ import annotations

from app.models.schemas import InvestigationContext
from app.modules.base import BaseInvestigationModule
from app.services.report_provider_factory import get_report_provider


class ReportGenerationModule(BaseInvestigationModule):
    module_id = "report_generation_module"
    module_name = "报告生成"

    def __init__(self) -> None:
        self.provider = get_report_provider()

    async def run(self, context: InvestigationContext) -> InvestigationContext:
        payload = context.model_dump(exclude={"final_report", "logs", "errors", "module_progress"})
        payload["status"] = context.status
        result = await self.provider.generate_report(payload)
        provider_label = self.provider.provider_name
        if result["success"]:
            context.final_report = result["parsed_data"]["report"]
            context.add_log(self.module_id, f"已通过 {provider_label} 生成报告")
            return context

        fallback = self._build_fallback_report(context, result["error"], provider_label)
        context.final_report = fallback
        context.add_error(self.module_id, f"{provider_label} 调用失败：{result['error']}")
        return context

    def _build_fallback_report(self, context: InvestigationContext, error: str | None, provider_label: str) -> str:
        lines = [
            f"# 执行背景调查报告\n",
            f"- 任务ID：{context.task_id}",
            f"- 调查主体：{context.subject_name}",
            f"- 主体类型：{'自然人' if context.subject_type == 'person' else '企业'}",
            f"- 调查范围：近{'3年' if context.time_range == '3y' else '5年'}",
            f"- 当前状态：{context.status}",
            f"- 报告 Provider：{provider_label}",
            "",
            "## 基础信息",
            f"- {context.basic_info.get('summary', '未查询到')}",
            "",
            "## 失信与限高",
            f"- {context.restriction_info.get('summary', '未查询到')}",
            "",
            "## 财产线索",
            f"- {context.asset_clues[0]['summary'] if context.asset_clues else '未查询到'}",
            "",
            "## 说明",
            f"- Provider 调用失败：{error or '待核实'}",
            "- 当前报告为本地兜底模板，未补充任何虚构事实。",
        ]
        return "\n".join(lines)
