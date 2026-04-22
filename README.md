# 法律工具集

江苏漫修（无锡）律师事务所 · 刘成律师

## 功能说明

一款实用的法律工具合集，包含以下功能：

- **律师费计算器**：根据案件类型和标的额计算律师服务费用，支持"一口价"和"基础 + 风险"两种模式
- **诉讼费计算器**：根据《诉讼费用交纳办法》计算财产案件、离婚案件的诉讼费用，支持财产保全费计算
- **天数计算器**：计算两个日期之间的天数间隔，或从某天加减若干天推算新日期
- **数字大写转换器**：将阿拉伯数字实时转换为中文大写金额，支持角分
- **高速自驾游**：竖屏驾驶小游戏，滑动控制，学习高速路网知识、车牌知识和口算练习
- **五子棋**：经典棋类小游戏，支持单人/双人模式，三种AI难度
- **HTML 可视化编辑器**：快速修改 HTML 汇报材料，支持文字直编、图片替换、进度条联动、样式编辑和一键导出
- **执行背景调查**：企业背调工具，通过企查查（主）和元典（备）查询数据，LLM 生成 Markdown 报告，支持 API Key 认证保护
- **利息/执行款计算器**：计算借款利息（支持多本金、LPR历史数据），计算执行款（支持多案、还款抵扣、迟延履行利息）

## 使用方式

直接在浏览器中打开 `index.html` 即可使用。

若要使用”执行背景调查”工具，双击 `start-backend.command` 即可一键启动后端（Mac）。然后从主页入口进入即可。

## 在线访问

[https://www.lawtools.top/](https://www.lawtools.top/)

## 项目结构

```
legal-tools/
├── index.html           # 主页
├── fee.html             # 律师费计算器
├── legalfee.html        # 诉讼费计算器
├── daycal.html          # 天数计算器
├── number.html          # 数字大写转换器
├── interest.html        # 利息/执行款计算器
├── highway-drive-game/      # 高速自驾游
│   ├── index.html
│   ├── css/style.css
│   ├── js/              # 游戏核心逻辑
│   ├── data/            # 题库、车辆、路网数据
│   └── assets/          # 图片、音效资源
├── gomoku.html          # 五子棋
├── html-editor/                  # HTML 可视化编辑器
│   ├── index.html        # 单文件应用
│   └── DEV.md            # 开发文档
├── investigation-tool/   # 执行背景调查工具
│   ├── frontend/index.html
│   ├── backend/          # FastAPI 本地后端
│   ├── data/tasks/       # 任务状态持久化
│   └── reports/          # Markdown 报告导出
└── .github/workflows/   # GitHub Actions 自动部署
```

## 技术栈

纯静态 HTML + CSS + JavaScript，零框架，零构建工具。

“执行背景调查”子项目额外包含：
- FastAPI
- Pydantic
- httpx
- 本地 LM Studio OpenAI 兼容接口

## 部署说明

项目通过 GitHub Actions 自动部署到阿里云 OSS，域名：lawtools.top

- 推送到 main 分支后自动触发部署
- 部署脚本：`.github/workflows/deploy.yml`

## 开发规范

### UI 设计规范

新工具统一采用 **Claude 设计系统**（Google Stitch DESIGN.md 风格），确保视觉一致性和现代感。

#### 设计原则

- **温暖色调**：页面使用羊皮纸色 `#f5f4ed`（Parchment）作为背景，卡片使用米白色 `#faf9f5`（Ivory）
- **品牌色**：主按钮使用陶土红 `#c96442`（Terracotta Brand）
- **暖灰文字**：所有灰色必须是暖色调（黄褐底色），不用冷蓝灰
- **圆角**：按钮 8-12px，卡片 8px，输入框 12px，保持柔和感
- **阴影**：使用 ring shadow `0px 0px 0px 1px` 创造边框般深度，不使用厚重阴影

#### 字体适配（中文字体）

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
```

标题字体（衬线体）需支持中文：
```css
font-family: -apple-system, "Songti SC", "SimSun", Georgia, serif;
```

#### 移动端适配

- 基础单位 8px
- 卡片内边距 24-32px
- 功能单元之间间距 18px
- 触摸目标最小 44x44px
- 响应式断点：<480px 单列布局

#### 使用方法

在项目根目录执行以下命令获取最新设计系统：
```bash
npx getdesign@latest add claude
```
然后参考生成的 `DESIGN.md` 文件进行开发。

#### 旧版工具（蓝色系）

早期工具使用蓝紫渐变配色体系，仅作为参考：
```css
--accent: #4F6AF0;
--bg: linear-gradient(180deg, #EDF0F8 0%, #F0F1F5 100%);
```

### 页面模板

每个工具页面应包含：
- `<meta charset="UTF-8">` 和 `<meta name="viewport">`
- `lang="zh-CN"`
- 页面标题格式：`工具名 - 法律工具集`
- 建议在页面底部或顶部放一个返回首页的链接

### 代码规范

- 缩进：4 空格
- CSS 变量命名：`--前缀-描述`
- 中文注释，关键逻辑要有注释
- 不使用 `var`，用 `const` / `let`
- 事件监听用 `addEventListener`，不用内联 `onclick`

## 更新日志

### 2026-04-22

- **新增执行背景调查工具**
  - 企业背调流水线：基础信息 → 风险查询 → 案例深挖 → 报告生成
  - 企查查（主）+ 元典（备）双数据源，支持统一社会信用代码和案号查询
  - LM Studio 本地 LLM 生成 Markdown 调查报告
  - API Key 认证保护，前端实时显示后端连接状态
  - 调查报告本地保存，支持 Markdown 导出

### 2026-04-10

- **新增五子棋游戏**
  - 支持单人模式（AI对战）和双人模式
  - 三种AI难度：简单、中等、困难
  - 触屏和鼠标操作支持
- **利息/执行款计算器**
  - 日期输入改为年月日独立输入框，限制4位年份，自动跳转下一个字段
  - 计算过程显示优化：去除"阶段"字样，增加加倍利息分段明细
  - 修复还款抵扣逻辑，严格按五阶段（费用→利息→本金→迟延利息→加倍利息）计算清偿顺序
  - 去除输入框年份箭头，优化一般利息显示
- **天数计算器**
  - 修复输入框溢出问题，输入框现在可以正确收缩适应宽度

### v2.5（2026-03）

- 利息/执行款计算器重写，支持多本金、多案、还款抵扣
- 路线扩充：新增常台高速、盐靖高速、宁宣高速等路线
- 题库扩充：新增题目覆盖服务区、枢纽、方言等知识点

---

© 2026 江苏漫修（无锡）律师事务所