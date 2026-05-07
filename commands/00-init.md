---
description: 一次性插件安装向导。检测各层插件并安装缺失项，完成后写入 Plugin Availability 标志位。
argument-hint: [--check-only | --layer L0/L1/L2/L3/L4/L45/L5]
---

# /00-init — 插件初始化

传统斜杠命令兼容入口。实际工作流在 `skills/00-init/SKILL.md`。

## 说明

检测并安装 dev-workflow 依赖的各层插件：

| 层级 | 插件 | 说明 |
|------|------|------|
| L0 | ECC 基础运行时 | Claude Code 核心 Agent 规则和技能库 |
| L0 | ECC Rules | 编码规范、安全标准、git 工作流 |
| L1 | Hooks 质量门 | commit 管控、execution-state 持久化 |
| L2 | RTK Token 压缩 | 智能截断过滤，节省 57-78% token |
| L3 | GitNexus 调用链分析 | 代码依赖图分析（MCP） |
| L4 | autoresearch 推理增强 | 深度搜索和多轮推理能力 |
| L5 | PUA 激励引擎 | 强制 AI 穷尽方案、防止"摆烂" |

## 调用方式

应用 `skills/00-init` 技能。

**参数**：`$ARGUMENTS`
- 留空 → 展示插件说明，询问安装意向
- `--check-only` → 只检测当前状态，不执行安装
- `--layer L5` → 只处理指定层

## 安装后效果

安装完成后，结果写入 `.mrd-to-code-config.json` 的 `plugin_availability` 字段，各 Skill 将直接读取此标志位，无需重复检测。

## 计时规范

遵循 `rules/common/timing-spec.md`。步骤定义：

| 步骤编号 | 步骤名称 |
|---------|---------|
| S1 | 插件状态检测 |
| S2 | 缺失插件安装 |
| S3 | 标志位写入（.mrd-to-code-config.json） |

报表子章节：`### /00-init 耗时报表`。
