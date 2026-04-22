from __future__ import annotations

from app.models.schemas import InvestigationContext
from app.modules.base import BaseInvestigationModule
from app.services.yuandian_service import YuandianService


class CaseDeepDiveModule(BaseInvestigationModule):
    module_id = "case_deep_dive_module"
    module_name = "案件深挖"

    def __init__(self) -> None:
        self.yuandian = YuandianService()

    async def run(self, context: InvestigationContext) -> InvestigationContext:
        if context.subject_type != "company":
            context.case_deep_dive = [{"summary": "当前仅支持企业查询"}]
            context.add_log(self.module_id, "案件深挖跳过：仅支持企业")
            return context

        # 从风险信息中获取案号
        restriction_data = context.restriction_info
        judicial_docs = restriction_data.get("judicial_documents", {}) if isinstance(restriction_data, dict) else {}
        case_list = judicial_docs if isinstance(judicial_docs, list) else judicial_docs.get("列表", [])

        if not case_list:
            context.case_deep_dive = [{"summary": "未查询到涉诉案件，无法深挖"}]
            context.add_log(self.module_id, "未查询到涉诉案件")
            return context

        results = []
        for case in case_list[:5]:  # 最多深挖5个案件
            case_number = case.get("案号") or case.get("ah", "")
            if not case_number:
                continue

            # 先尝试普通案例，再尝试权威案例
            result = await self.yuandian.deep_dive_case(case_number=case_number, case_type="ptal")
            if not result.get("found"):
                result = await self.yuandian.deep_dive_case(case_number=case_number, case_type="qwal")

            if result.get("found"):
                case_data = result.get("parsed_data", {})
                results.append({
                    "case_number": case_number,
                    "title": case_data.get("title", ""),
                    "court": case_data.get("jbdw", ""),
                    "case_type": case_data.get("ajlx", ""),
                    "result": case_data.get("pjjg", "")[:500] if case_data.get("pjjg") else "",
                    "judgment_date": case_data.get("cprq", ""),
                })
            else:
                results.append({
                    "case_number": case_number,
                    "summary": "未查询到详情",
                })

        context.case_deep_dive = results
        context.add_log(self.module_id, f"已深挖 {len(results)} 个案件")
        return context
