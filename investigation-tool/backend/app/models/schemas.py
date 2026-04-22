from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


SubjectType = Literal["person", "company"]
TimeRange = Literal["3y", "5y"]
TaskStatus = Literal["pending", "running", "completed", "failed"]
ModuleStatus = Literal["pending", "running", "completed", "failed", "skipped"]


class LogEntry(BaseModel):
    timestamp: str
    module_id: str
    message: str
    level: Literal["info", "warning", "error"] = "info"


class ErrorEntry(BaseModel):
    timestamp: str
    module_id: str
    message: str


class ModuleProgress(BaseModel):
    module_id: str
    module_name: str
    status: ModuleStatus = "pending"


class InvestigationRequest(BaseModel):
    subject_name: str = Field(min_length=1, max_length=200)
    credit_code: str | None = Field(default=None, max_length=18)
    subject_type: SubjectType
    time_range: TimeRange
    include_bidding: bool = False
    supplement_qichacha: bool = Field(default=False, description="元典查到后是否用企查查补充查询")


class InvestigationContext(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid4()))
    subject_name: str
    credit_code: str | None = None
    subject_type: SubjectType
    time_range: TimeRange
    include_bidding: bool = False
    supplement_qichacha: bool = False
    time_range: TimeRange
    include_bidding: bool = False
    status: TaskStatus = "pending"
    current_module: str = ""
    module_progress: list[ModuleProgress] = Field(default_factory=list)
    basic_info: dict[str, Any] = Field(default_factory=dict)
    restriction_info: dict[str, Any] = Field(default_factory=dict)
    related_companies: list[dict[str, Any]] = Field(default_factory=list)
    litigation_cases: list[dict[str, Any]] = Field(default_factory=list)
    key_cases_for_review: list[dict[str, Any]] = Field(default_factory=list)
    case_deep_dive: list[dict[str, Any]] = Field(default_factory=list)
    bidding_records: list[dict[str, Any]] = Field(default_factory=list)
    asset_clues: list[dict[str, Any]] = Field(default_factory=list)
    final_report: str = ""
    logs: list[LogEntry] = Field(default_factory=list)
    errors: list[ErrorEntry] = Field(default_factory=list)

    @classmethod
    def from_request(cls, request: InvestigationRequest) -> "InvestigationContext":
        return cls(
            subject_name=request.subject_name.strip(),
            credit_code=request.credit_code,
            subject_type=request.subject_type,
            time_range=request.time_range,
            include_bidding=request.include_bidding,
            supplement_qichacha=request.supplement_qichacha,
        )

    def add_log(self, module_id: str, message: str, level: Literal["info", "warning", "error"] = "info") -> None:
        self.logs.append(
            LogEntry(
                timestamp=datetime.now().isoformat(timespec="seconds"),
                module_id=module_id,
                message=message,
                level=level,
            )
        )

    def add_error(self, module_id: str, message: str) -> None:
        self.errors.append(
            ErrorEntry(
                timestamp=datetime.now().isoformat(timespec="seconds"),
                module_id=module_id,
                message=message,
            )
        )
        self.add_log(module_id, message, level="error")
