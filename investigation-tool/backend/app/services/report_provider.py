from __future__ import annotations

from typing import Any, Protocol


class ReportProvider(Protocol):
    provider_name: str

    async def generate_report(self, payload: dict[str, Any]) -> dict[str, Any]:
        ...
