from __future__ import annotations

from app.models.schemas import InvestigationContext, InvestigationRequest


def build_investigation_context(request: InvestigationRequest) -> InvestigationContext:
    return InvestigationContext.from_request(request)
