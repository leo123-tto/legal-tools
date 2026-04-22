#!/bin/bash
# 双击此文件启动执行背景调查后端

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/investigation-tool/backend"
ENV_FILE="$BACKEND_DIR/.env"

# 查找并停止占用 8000 端口的旧后端进程
OLD_PID=$(lsof -ti :8000 2>/dev/null)
if [ -n "$OLD_PID" ]; then
    echo "发现旧后端进程 (PID: $OLD_PID)，正在停止..."
    kill $OLD_PID 2>/dev/null
    sleep 1
fi

# 构造启动命令
START_CMD="cd '$BACKEND_DIR' && source .venv/bin/activate && "
if [ -f "$ENV_FILE" ]; then
    START_CMD="$START_CMD set -a && source .env && set +a && "
fi
START_CMD="$START_CMD uvicorn main:app --reload --port 8000"

osascript <<EOF
tell application "Terminal"
    activate
    do script ""
end tell
EOF

sleep 0.5

osascript -e "tell application \"Terminal\" to do script \"$START_CMD\" in front window"

echo "后端启动中，请切换到 Terminal 窗口..."
echo "启动后访问 http://127.0.0.1:8000/health 确认"
