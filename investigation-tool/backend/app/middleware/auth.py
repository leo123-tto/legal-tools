from __future__ import annotations

import os
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware


# 允许的 API Keys（支持多个，逗号分隔）
ALLOWED_API_KEYS = os.getenv("ALLOWED_API_KEYS", "").split(",")
ALLOWED_API_KEYS = [k.strip() for k in ALLOWED_API_KEYS if k.strip()]


def verify_api_key(request: Request) -> bool:
    """验证 API Key"""
    if not ALLOWED_API_KEYS:
        return True  # 未配置 Key 时不验证

    # 从请求头获取 Key
    api_key = request.headers.get("X-API-Key", "")

    # 也支持从 query 参数获取
    if not api_key:
        api_key = request.query_params.get("api_key", "")

    return api_key in ALLOWED_API_KEYS


class APIKeyMiddleware(BaseHTTPMiddleware):
    """API Key 认证中间件"""

    async def dispatch(self, request: Request, call_next):
        # 跳过健康检查和文档
        if request.url.path in ("/health", "/docs", "/openapi.json", "/redoc"):
            return await call_next(request)

        # 验证 API Key
        if not verify_api_key(request):
            raise HTTPException(
                status_code=401,
                detail="未授权：请提供有效的 API Key (X-API-Key header)"
            )

        return await call_next(request)
