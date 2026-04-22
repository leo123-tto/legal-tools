# 执行背景调查工具

企业背调工具，通过企查查/元典 API 查询数据，LLM 生成报告。

## 功能特性

- 🔍 **多数据源**：企查查（主）、元典（备）企业信息查询
- 📄 **案例深挖**：通过案号查询裁判文书详情
- 🤖 **灵活报告**：支持 LM Studio 本地模型生成报告（其余 Provider 预留）
- 🔐 **访问控制**：API Key 认证保护
- 💾 **本地存储**：调查报告本地保存

## 快速开始

### 1. 安装依赖

```bash
cd investigation-tool/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
nano .env
```

必需配置：
```bash
# 元典 API Key（必填）
YUANDIAN_API_KEY=your_yuandian_api_key

# 企查查 CLI（运行一次配置）
qcc init --authorization "Bearer your_qcc_api_key"

# 访问控制（必填，设置访问密钥）
ALLOWED_API_KEYS=your-secret-key
```

### 3. 启动后端

**方式一（推荐）：双击 `start-backend.command`**，会自动打开终端并启动后端。

**方式二：手动启动**
```bash
cd investigation-tool/backend
source .venv/bin/activate
set -a && source .env && set +a
uvicorn main:app --reload --port 8000
```

### 4. 访问

从主页入口进入"执行背景调查"页面，点击右上角 ⚙️ 设置，输入：
- 后端地址：`http://127.0.0.1:8000`
- API Key：你在 `.env` 中 `ALLOWED_API_KEYS` 设置的密钥

## 数据源

### 企查查 CLI（主数据源）
- 安装：`npm install -g qcc-agent-cli`
- 配置：`qcc init --authorization "Bearer YOUR_API_KEY"`
- 积分：每天 500 免费积分
- 文档：https://agent.qcc.com/

### 元典 API（备用数据源）
- 企业详情：`rh_company_detail`
- 案例详情：`rh_case_details`
- 文档：https://open.chineselaw.com/

### 查询方式
- **统一社会信用代码**（18位）：如 `91320213768290914X`
- **案号**：如 `（2021）苏0213执1460号`

## LLM Provider

> 注意：目前只有 LM Studio 经过实际测试可用，其余为预留接口。

| Provider | 说明 | 状态 |
|----------|------|------|
| `lm_studio` | 本地 LM Studio | ✅ 已测试 |
| `hermes` | Hermes Agent API Server | 🔜 待接入 |
| `cloud` | 云端中转站 API | 🔜 待接入 |
| `claude_code` | Claude Code | 🔜 预留 |

切换方式：设置环境变量 `REPORT_PROVIDER`，并确保对应 provider 的配置项已填写。

## API 接口

```
POST /api/investigation/start          # 启动调查
GET  /api/investigation/{id}/status   # 查询状态
GET  /api/investigation/{id}/result   # 获取结果
GET  /api/investigation/{id}/report.md # Markdown 报告
GET  /health                          # 健康检查
```

### 请求示例

```bash
curl -X POST http://127.0.0.1:8000/api/investigation/start \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "subject_name": "91320213768290914X",
    "subject_type": "company",
    "time_range": "3y",
    "include_bidding": false
  }'
```

## 项目结构

```
investigation-tool/
├── backend/
│   ├── app/
│   │   ├── modules/           # Pipeline 模块
│   │   │   ├── basic_info_module.py      # 企业信息查询
│   │   │   ├── restriction_module.py     # 风险查询
│   │   │   ├── case_deep_dive_module.py  # 案例深挖
│   │   │   ├── bidding_module.py         # 招投标
│   │   │   └── report_generation_module.py
│   │   ├── services/
│   │   │   ├── qichacha_service.py       # 企查查 CLI
│   │   │   ├── yuandian_service.py       # 元典 API
│   │   │   └── report_provider*.py       # LLM Provider
│   │   ├── middleware/
│   │   │   └── auth.py                  # API Key 认证
│   │   └── core/
│   │       └── pipeline.py
│   ├── reports/              # 生成报告
│   ├── data/tasks/          # 任务数据
│   ├── .env.example         # 环境变量模板
│   └── .gitignore
├── frontend/
│   └── index.html
└── README.md
```

## 安全说明

- API Key 存储在本地 localStorage
- 后端环境变量不在代码中硬编码
- `.env` 文件已加入 `.gitignore`
- 企查查 Key 配置在 `~/.qcc/config.json`

## 待接入

- [ ] Hermes Provider 测试
- [ ] Cloud Provider 测试
- [ ] PDF 报告导出
- [ ] 后端云端部署（移动端访问）
