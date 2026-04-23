from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import PlainTextResponse

from app.core.context import build_investigation_context
from app.core.pipeline import InvestigationPipeline
from app.models.schemas import InvestigationRequest
from app.services.task_store import TaskStore

router = APIRouter(prefix="/api/investigation", tags=["investigation"])
BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / "data" / "tasks"
REPORT_DIR = BASE_DIR / "reports"
store = TaskStore(str(DATA_DIR))


def run_pipeline(task_id: str) -> None:
    import asyncio

    context = store.load(task_id)
    pipeline = InvestigationPipeline(store)
    result = asyncio.run(pipeline.run(context))
    report_path = REPORT_DIR / f"{result.task_id}.md"
    report_path.write_text(result.final_report or "", encoding="utf-8")


# 静态路由放前面，避免被 /{task_id} 误匹配
@router.get("/")
def list_investigations() -> list[dict]:
    """返回所有任务摘要列表（按修改时间倒序）。"""
    if not DATA_DIR.exists():
        return []
    tasks = []
    for f in sorted(DATA_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            import json

            ctx = json.loads(f.read_text())
            tasks.append(
                {
                    "task_id": ctx.get("task_id", f.stem),
                    "status": ctx.get("status", "unknown"),
                    "subject_name": ctx.get("subject_name", ""),
                    "subject_type": ctx.get("subject_type", ""),
                }
            )
        except Exception:
            pass
    return tasks


@router.get("/{task_id}/logs")
def get_task_logs(task_id: str) -> list[dict]:
    """返回指定任务的日志列表。"""
    if not store.exists(task_id):
        raise HTTPException(status_code=404, detail="任务不存在")
    context = store.load(task_id)
    return [log.model_dump() for log in context.logs]


@router.post("/start")
def start_investigation(request: InvestigationRequest, background_tasks: BackgroundTasks) -> dict:
    context = build_investigation_context(request)
    store.save(context)
    background_tasks.add_task(run_pipeline, context.task_id)
    return {"task_id": context.task_id, "status": context.status}


@router.get("/{task_id}/status")
def get_status(task_id: str) -> dict:
    if not store.exists(task_id):
        raise HTTPException(status_code=404, detail="任务不存在")
    context = store.load(task_id)
    return {
        "task_id": context.task_id,
        "status": context.status,
        "current_module": context.current_module,
        "module_progress": [item.model_dump() for item in context.module_progress],
        "errors": [item.model_dump() for item in context.errors],
    }


@router.get("/{task_id}/result")
def get_result(task_id: str) -> dict:
    if not store.exists(task_id):
        raise HTTPException(status_code=404, detail="任务不存在")
    return store.load(task_id).model_dump()


@router.get("/{task_id}/report")
def get_report(task_id: str) -> dict:
    if not store.exists(task_id):
        raise HTTPException(status_code=404, detail="任务不存在")
    context = store.load(task_id)
    return {"task_id": task_id, "report": context.final_report}


@router.get("/{task_id}/report.md")
def download_report(task_id: str) -> PlainTextResponse:
    if not store.exists(task_id):
        raise HTTPException(status_code=404, detail="任务不存在")
    context = store.load(task_id)
    return PlainTextResponse(
        context.final_report,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{task_id}.md"'},
    )
