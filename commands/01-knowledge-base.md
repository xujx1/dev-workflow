---
description: 构建或更新应用知识库。传入应用名或留空自动识别。
argument-hint: [应用名 | 留空自动识别]
---

# /01-knowledge-base — 知识库构建

传统斜杠命令兼容入口。实际工作流在 `skills/01-knowledge-base/SKILL.md`。

## 使用前提醒

本命令进入正式 Skill 前，先读取 `.mrd-to-code-config.json` 的 `plugin_availability` 字段。

| 标志位 | 影响能力 |
|--------|---------|
| `l3_gitnexus=available` | GitNexus 调用链分析 |
| `l4_autoresearch=available` | autoresearch 推理增强 |

> 如需安装插件，请运行：`/dev-workflow:00-init`

## 说明

构建知识库：

- `app-knowledge-base/` — 架构、接口、流程、工程规范

## 调用方式

应用 `skills/01-knowledge-base` 技能。

**参数**：`$ARGUMENTS` — 传入应用名（如 `trade-service`）或留空让 Agent 自动识别当前项目。

## 计时规范

遵循 `rules/common/timing-spec.md`。步骤定义：

| 步骤编号 | 步骤名称 |
|---------|---------|
| S1 | app-knowledge-base 构建 |
| S4 | 交叉校验与一致性检查 |

报表子章节：`### /01-knowledge-base 耗时报表`。
