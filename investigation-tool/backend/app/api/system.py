from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/system", tags=["system"])

_BACKEND_DIR = Path(__file__).resolve().parents[3]
_DATA_DIR = _BACKEND_DIR / "data" / "tasks"


@router.get("/status")
def get_system_status(request: Request) -> dict:
    """返回系统状态，包括后端信息、LM Studio 状态、任务统计。"""
    import httpx

    # LM Studio 在线检测
    lm_online = False
    lm_models = []
    try:
        with httpx.Client(timeout=3.0, trust_env=False) as client:
            resp = client.get("http://127.0.0.1:1234/v1/models")
            if resp.status_code == 200:
                lm_online = True
                data = resp.json()
                lm_models = [
                    m.get("id", "")
                    for m in data.get("data", [])
                    if m.get("id")
                ]
    except Exception:
        pass

    # 任务统计
    total = 0
    completed = 0
    running = 0
    failed = 0
    if _DATA_DIR.exists():
        for f in _DATA_DIR.glob("*.json"):
            try:
                import json

                ctx = json.loads(f.read_text())
                total += 1
                status = ctx.get("status", "pending")
                if status == "completed":
                    completed += 1
                elif status == "running":
                    running += 1
                elif status == "failed":
                    failed += 1
            except Exception:
                pass

    # 后端启动时间（近似，通过进程 uptime 推断）
    try:
        import resource

        boot_time = datetime.now().isoformat()
    except Exception:
        boot_time = None

    return {
        "backend": {
            "running": True,
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "port": 8000,
        },
        "lm_studio": {
            "online": lm_online,
            "models": lm_models,
            "error": None,
        },
        "tasks": {
            "total": total,
            "completed": completed,
            "running": running,
            "failed": failed,
        },
    }
