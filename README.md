# 法律工具集

江苏漫修（无锡）律师事务所 · 刘成律师

## 功能说明

一款实用的法律工具合集，包含以下功能：

- **律师费计算器**：根据案件类型和标的额计算律师服务费用，支持"一口价"和"基础 + 风险"两种模式
- **诉讼费计算器**：根据《诉讼费用交纳办法》计算财产案件、离婚案件的诉讼费用，支持财产保全费计算
- **天数计算器**：计算两个日期之间的天数间隔，或从某天加减若干天推算新日期
- **数字大写转换器**：将阿拉伯数字实时转换为中文大写金额，支持角分
- **高速自驾游**：竖屏驾驶小游戏，滑动控制，学习高速路网知识、车牌知识和口算练习
- **HTML 可视化编辑器**：快速修改 HTML 汇报材料，支持文字直编、图片替换、进度条联动、样式编辑和一键导出
- **利息/执行款计算器**：计算借款利息（支持多本金、LPR历史数据），计算执行款（支持多案、还款抵扣、迟延履行利息）

## 使用方式

直接在浏览器中打开 `index.html` 即可使用。

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
├── highway-drive-game-vertical/  # 高速自驾游（竖屏版）
│   ├── index.html
│   ├── css/style.css
│   ├── js/              # 游戏核心逻辑
│   ├── data/            # 题库、车辆、路网数据
│   └── assets/          # 图片、音效资源
├── html-editor/                  # HTML 可视化编辑器
│   ├── index.html        # 单文件应用
│   └── DEV.md            # 开发文档
└── .github/workflows/   # GitHub Actions 自动部署
```

## 技术栈

纯静态 HTML + CSS + JavaScript，零框架，零构建工具

## 部署说明

项目通过 GitHub Actions 自动部署到阿里云 OSS，域名：lawtools.top

- 推送到 main 分支后自动触发部署
- 部署脚本：`.github/workflows/deploy.yml`

## 开发规范

### UI 设计规范

- **极简现代风**：干净、留白充足、无多余装饰
- **移动端优先**：所有工具必须在手机上可用，优先适配 iPhone 竖屏比例
- **无外部依赖**：不引入 CDN、不用 npm、不用框架
- **单文件优先**：HTML + CSS + JS 写在一个 .html 文件中，除非复杂度确实需要拆分
- **中文界面**：按钮、标签、提示等一律使用中文
- **触摸友好**：按钮和输入框尺寸适合手指点击，间距合理

### 配色体系（浅色系）

```css
--bg-deep: #F0F1F5;           /* 页面背景 - 淡灰蓝 */
--bg-card: rgba(255, 255, 255, 0.88);  /* 卡片背景 */
--bg-input: rgba(240, 242, 248, 0.8);   /* 输入框背景 */
--text-primary: #1A1D2E;       /* 标题、正文 */
--text-secondary: rgba(60, 68, 90, 0.8); /* 说明文字 */
--accent: #4F6AF0;             /* 主色调 */
--accent-gradient: linear-gradient(135deg, #4F6AF0 0%, #9B6FE8 100%);
--border: rgba(80, 90, 130, 0.12);
--radius-lg: 20px;            /* 大卡片圆角 */
--radius-md: 14px;            /* 中等元素圆角 */
--radius-sm: 10px;            /* 小按钮圆角 */
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

---

© 2026 江苏漫修（无锡）律师事务所