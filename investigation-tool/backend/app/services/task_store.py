from __future__ import annotations

import json
from pathlib import Path

from app.models.schemas import InvestigationContext


class TaskStore:
    def __init__(self, data_dir: str) -> None:
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def get_path(self, task_id: str) -> Path:
        return self.data_dir / f"{task_id}.json"

    def save(self, context: InvestigationContext) -> None:
        path = self.get_path(context.task_id)
        path.write_text(context.model_dump_json(indent=2), encoding="utf-8")

    def load(self, task_id: str) -> InvestigationContext:
        path = self.get_path(task_id)
        data = json.loads(path.read_text(encoding="utf-8"))
        return InvestigationContext.model_validate(data)

    def exists(self, task_id: str) -> bool:
        return self.get_path(task_id).exists()
