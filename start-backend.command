#!/bin/bash
# 双击此文件启动执行背景调查后端

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/investigation-tool/backend"
ENV_FILE="$BACKEND_DIR/.env"

# 打开一个新的终端窗口并在其中运行命令
osascript <<'APPLESCRIPT'
tell application "Terminal"
    activate
    do script ""
end tell
APPLESCRIPT

# 等待终端打开
sleep 1

# 构造启动命令
START_CMD="cd '$BACKEND_DIR' && source .venv/bin/activate && "
if [ -f "$ENV_FILE" ]; then
    START_CMD="$START_CMD set -a && source .env && set +a && "
fi
START_CMD="$START_CMD uvicorn main:app --reload --port 8000"

# 在终端中执行
osascript -e "tell application \"Terminal\" to do script \"$START_CMD\" in front window"

echo "后端启动中，请切换到 Terminal 窗口查看..."
