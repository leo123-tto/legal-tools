# 法律工具集 - 项目开发指南

> 本文件是 AI 助手（Claude Code）的项目上下文文件，也是整个项目的开发规范文档。
> 每次对话开始时会自动加载，确保开发风格一致。

## 项目概况

- **项目名称**：法律工具集（legal-tools）
- **所有者**：刘成律师 · 江苏漫修（无锡）律师事务所
- **线上地址**：https://www.lawtools.top/
- **GitHub 仓库**：https://github.com/leo123-tto/legal-tools
- **技术栈**：纯静态 HTML + CSS + JavaScript，零框架，零构建工具
- **托管方式**：阿里云 OSS 静态网站托管（香港节点），域名 lawtools.top

## 部署流程

```
本地开发 → git push origin main → GitHub Actions 自动触发 → ossutil 同步到阿里云 OSS → 网站更新
```

- 部署配置文件：`.github/workflows/deploy-oss.yml`
- OSS Bucket：`lawtools-hk`（香港节点 `oss-cn-hongkong.aliyuncs.com`）
- 推送到 `main` 分支后约 1-2 分钟自动生效
- **无需手动部署**，push 即上线

## 用户常用指令

用户（刘成律师）不懂代码，以下是他可能给出的简单指令及对应操作：

| 用户说 | 你应该做 |
|--------|----------|
| "上传 GitHub" / "推送" / "发布" | `git add` 相关文件 → `git commit` → `git push origin main` |
| "做个新工具" | 在项目根目录创建新文件夹或 .html 文件，更新 index.html 添加入口卡片，更新 README.md |
| "改一下首页" | 编辑 `index.html` |
| "看看部署成功没" | `gh run list --limit 3` 查看最近的 Actions 运行状态 |

## 项目结构

```
legal-tools/
├── index.html                        # 首页（工具导航）
├── fee.html                          # 律师费计算器
├── legalfee.html                     # 诉讼费计算器
├── daycal.html                       # 天数计算器
├── number.html                       # 数字大写转换器
├── highway-drive-game-vertical/      # 高速自驾游（竖屏版，多文件）
├── html-editor/                      # HTML 可视化编辑器
│   ├── index.html                    # 单文件应用
│   └── DEV.md                        # 开发文档
├── .github/workflows/deploy-oss.yml  # 自动部署配置
├── README.md                         # 项目说明
└── CLAUDE.md                         # 本文件（开发规范）
```

## 添加新工具的标准流程

### 1. 创建工具文件

- **简单工具**（单页面）：在根目录创建 `工具名.html`，如 `timer.html`
- **复杂工具**（多文件）：创建子目录 `工具名/index.html`，如 `html-editor/index.html`

### 2. 更新首页入口

在 `index.html` 的 `<div class="tools-grid">` 内添加卡片：

```html
<a href="工具名.html" class="tool-card">
    <span class="tool-icon">📌</span>
    <div class="tool-name">工具名称</div>
    <div class="tool-desc">一句话描述工具功能。</div>
</a>
```

### 3. 更新 README.md

在功能列表中添加一行描述。

### 4. 提交并推送

```bash
git add 新文件 index.html README.md
git commit -m "添加XXX工具"
git push origin main
```

## UI 设计规范

所有工具必须遵循统一的视觉风格，确保整体一致性。

### 基础原则

- **极简现代风**：干净、留白充足、无多余装饰
- **移动端优先**：所有工具必须在手机上可用，优先适配 iPhone 竖屏比例
- **无外部依赖**：不引入 CDN、不用 npm、不用框架（React/Vue/Tailwind 等）
- **单文件优先**：HTML + CSS + JS 写在一个 .html 文件中，除非复杂度确实需要拆分
- **中文界面**：按钮、标签、提示等一律使用中文，避免英文标签
- **触摸友好**：按钮和输入框尺寸适合手指点击，间距合理，避免误触

### 配色体系（浅色系）

工具页面采用浅色系配色，柔和舒适，带蓝紫渐变点缀：

```css
/* 页面背景 - 淡灰蓝，非纯白 */
--bg-deep: #F0F1F5;

/* 卡片背景 - 半透明白色毛玻璃 */
--bg-card: rgba(255, 255, 255, 0.88);

/* 输入框背景 */
--bg-input: rgba(240, 242, 248, 0.8);
--bg-input-focus: rgba(232, 236, 248, 0.95);

/* 文字层级 */
--text-primary: #1A1D2E;                    /* 标题、正文 */
--text-secondary: rgba(60, 68, 90, 0.8);    /* 说明文字 */
--text-dim: rgba(100, 110, 135, 0.65);      /* 辅助信息 */

/* 主色调 - 蓝紫渐变 */
--accent: #4F6AF0;
--accent-gradient: linear-gradient(135deg, #4F6AF0 0%, #9B6FE8 100%);

/* 边框 */
--border: rgba(80, 90, 130, 0.12);
--border-focus: rgba(79, 106, 240, 0.45);
```

首页保持原有配色（`--accent: #1E40AF`，`--bg-primary: #FAFAFA`）。

### 字体

```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Arial, sans-serif;
```

### 圆角

- 大卡片：`24px`
- 中等元素：`16px`
- 小按钮/输入框：`12px`

### 阴影

```css
--shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
--shadow-hover: 0 12px 48px rgba(0, 0, 0, 0.12);
```

### 响应式断点

- 小屏手机：`max-width: 380px`，进一步压缩 padding、字号和间距
- 移动端：`max-width: 480px`，减小 padding 和字号
- 工具内部布局在小屏幕上应自动堆叠为单列
- 输入框使用 `flex: 1; min-width: 0; width: 0;` 防止溢出容器

### 页面模板

每个工具页面应包含：
- `<meta charset="UTF-8">` 和 `<meta name="viewport">`
- `lang="zh-CN"`
- 页面标题格式：`工具名 - 法律工具集`
- 建议在页面底部或顶部放一个返回首页的链接

## 代码规范

- 缩进：4 空格（与现有代码一致）
- CSS 变量命名：`--前缀-描述`，如 `--bg-primary`
- 中文注释，关键逻辑要有注释
- 不使用 `var`，用 `const` / `let`
- 事件监听用 `addEventListener`，不用内联 `onclick`

## Git 提交规范

- 提交信息用中文
- 格式：`动词 + 内容`，如 `添加天数计算器`、`修复律师费计算精度问题`、`更新首页布局`
- 每个工具的首次提交应包含：工具文件 + index.html 更新 + README.md 更新

## 注意事项

- `.DS_Store` 已在 `.gitignore` 中忽略
- `.claude/`、`.clawhub/`、`memory/` 等本地配置目录不要提交
- 部署会同步整个仓库到 OSS，注意不要提交敏感信息
- OSS 的 secrets（`ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET`）配置在 GitHub 仓库的 Settings → Secrets 中
