from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/config", tags=["config"])

_BACKEND_DIR = Path(__file__).resolve().parents[3]
_ENV_FILE = _BACKEND_DIR / ".env"


def _read_env() -> dict[str, str]:
    if not _ENV_FILE.exists():
        return {}
    env = {}
    for line in _ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def _write_env(env: dict[str, str]) -> None:
    lines = [f"{k}={v}" for k, v in env.items()]
    _ENV_FILE.write_text("\n".join(lines) + "\n")


def _mask_key(key: str) -> str:
    if len(key) <= 8:
        return "***"
    return key[:4] + "***" + key[-4:]


@router.get("/models")
def get_model_config() -> dict:
    env = _read_env()
    return {
        "report_provider": env.get("REPORT_PROVIDER", "lm_studio"),
        "api_base_url": env.get("LM_STUDIO_BASE_URL", "http://127.0.0.1:1234/v1"),
        "report_model": env.get("REPORT_MODEL", ""),
        "temperature": float(env.get("REPORT_MODEL_TEMPERATURE", "0.3")),
    }


@router.put("/models")
def update_model_config(payload: dict) -> dict:
    env = _read_env()
    if "report_provider" in payload:
        env["REPORT_PROVIDER"] = payload["report_provider"]
    if "api_base_url" in payload:
        key = (
            "HERMES_BASE_URL"
            if payload["report_provider"] == "hermes"
            else "CLOUD_API_BASE_URL"
            if payload["report_provider"] == "cloud"
            else "LM_STUDIO_BASE_URL"
        )
        env[key] = payload["api_base_url"]
    if "report_model" in payload:
        env["REPORT_MODEL"] = payload["report_model"]
    if "temperature" in payload:
        env["REPORT_MODEL_TEMPERATURE"] = str(payload["temperature"])
    if "api_key" in payload:
        key = (
            "HERMES_API_KEY"
            if payload["report_provider"] == "hermes"
            else "CLOUD_API_KEY"
            if payload["report_provider"] == "cloud"
            else "REPORT_API_KEY"
        )
        env[key] = payload["api_key"]
    _write_env(env)
    return {"status": "ok", "message": "配置已保存，重启后端后生效"}


@router.get("/modules")
def get_modules() -> list[dict]:
    from app.core.pipeline import InvestigationPipeline

    pipeline = InvestigationPipeline(None)
    return [
        {
            "module_id": m.module_id,
            "name": m.module_name,
            "enabled": True,
        }
        for m in pipeline.modules
    ]


@router.put("/modules/{module_id}")
def toggle_module(module_id: str, payload: dict) -> dict:
    return {"module_id": module_id, "enabled": payload.get("enabled", True)}


@router.get("/keys")
def get_key_pool_status() -> dict:
    """返回各 Key 池的使用统计（不暴露真实 Key 内容）。"""
    env = _read_env()
    result = {}

    for name, env_key in [
        ("元典", "YUANDIAN_API_KEYS"),
        ("企查查", "QCC_AUTHORIZATIONS"),
    ]:
        raw = env.get(env_key, os.getenv(env_key, ""))
        if not raw:
            result[name] = {"count": 0, "used": False, "error": None}
            continue
        keys = [k.strip() for k in raw.split(",") if k.strip()]
        result[name] = {
            "count": len(keys),
            "masked": [_mask_key(k) for k in keys],
            "used": False,
            "error": None,
        }

    return result


@router.get("/access")
def get_access_config() -> dict:
    env = _read_env()
    keys = env.get("ALLOWED_API_KEYS", os.getenv("ALLOWED_API_KEYS", ""))
    return {
        "allowed_keys": [_mask_key(k) for k in keys.split(",") if k.strip()],
    }


@router.put("/access")
def update_access_config(payload: dict) -> dict:
    env = _read_env()
    if "allowed_keys" in payload:
        env["ALLOWED_API_KEYS"] = ",".join(payload["allowed_keys"])
    _write_env(env)
    return {"status": "ok"}
