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
