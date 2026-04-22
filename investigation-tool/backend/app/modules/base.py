from __future__ import annotations

from abc import ABC, abstractmethod

from app.models.schemas import InvestigationContext


class BaseInvestigationModule(ABC):
    module_id: str = ""
    module_name: str = ""
    enabled: bool = True

    def should_run(self, context: InvestigationContext) -> bool:
        return self.enabled

    def validate_input(self, context: InvestigationContext) -> None:
        if not context.subject_name:
            raise ValueError("调查主体不能为空")

    def validate_output(self, context: InvestigationContext) -> None:
        return None

    @abstractmethod
    async def run(self, context: InvestigationContext) -> InvestigationContext:
        raise NotImplementedError
