from app.api.investigation import router as investigation_router
from app.api.config import router as config_router
from app.api.system import router as system_router
from app.middleware.auth import APIKeyMiddleware
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="执行背景调查工具", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 添加 API Key 认证中间件
app.add_middleware(APIKeyMiddleware)

app.include_router(investigation_router)
app.include_router(config_router)
app.include_router(system_router)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
