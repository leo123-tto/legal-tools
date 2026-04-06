# 法律工具集

江苏漫修（无锡）律师事务所 · 刘成律师

## 功能说明

一款实用的法律工具合集，包含以下功能：

- **律师费计算器**：根据案件类型和标的额计算律师服务费用，支持"一口价"和"基础 + 风险"两种模式
- **诉讼费计算器**：根据《诉讼费用交纳办法》计算财产案件、离婚案件的诉讼费用，支持财产保全费计算
- **天数计算器**：计算两个日期之间的天数间隔，或从某天加减若干天推算新日期
- **数字大写转换器**：将阿拉伯数字实时转换为中文大写金额，支持角分
- **高速自驾游**：竖屏驾驶小游戏，滑动控制，学习高速路网知识、车牌知识和口算练习

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
├── highway-drive-game-vertical/  # 高速自驾游（竖屏版）
│   ├── index.html
│   ├── css/style.css
│   ├── js/              # 游戏核心逻辑
│   ├── data/            # 题库、车辆、路网数据
│   └── assets/          # 图片、音效资源
└── .github/workflows/   # GitHub Actions 自动部署
```

## 部署说明

项目通过 GitHub Actions 自动部署到阿里云 OSS，域名：lawtools.top

- 推送到 main 分支后自动触发部署
- 部署脚本：`.github/workflows/deploy.yml`

---

© 2026 江苏漫修（无锡）律师事务所
