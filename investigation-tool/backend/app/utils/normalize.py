from __future__ import annotations

from typing import Any


def normalize_unavailable(value: Any, fallback: str = "未查询到") -> Any:
    if value in (None, "", [], {}):
        return fallback
    return value
