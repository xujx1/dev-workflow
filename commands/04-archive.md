---
description: 归档本次需求迭代：生成存档报告、更新知识库、提取 AI 协作 instinct。传入需求名称或迭代标识。
argument-hint: [需求名称 | 迭代标识]
---

# /04-archive — 迭代归档

传统斜杠命令兼容入口。实际工作流在 `skills/04-archive/SKILL.md`。

## 使用前提醒

首次在业务工程中使用本命令前，建议先补齐基础环境，确保 `execution-state.md` 断点续传能力正常工作。

- 统一插件清单：`plugins/README.md`
- 必装：先执行 `/plugin marketplace add https://github.com/affaan-m/everything-claude-code`
- 必装：执行 `brew install rtk && rtk init --global`
- 安装后重启一次 Claude Code

## 说明

5 阶段归档流程：
1. **OpenSpec 归档**（openspec-archive-agent，可选）
2. **校验 AI commit + 锁定当前分支最新代码快照**（先校验 `ai_commit_hash` 可解析，再记录 `archive_code_ref=HEAD`）
3. **知识库更新**（kb-update-agent，知识库事实以 `archive_code_ref` 为准）
4. **归档报告**（archive-report-agent，最终代码事实以 `archive_code_ref` 为准）
5. **Instinct 提取**（instinct-extract-agent，后台非阻塞）

## 调用方式

应用 `skills/04-archive` 技能。

**参数**：`$ARGUMENTS` — 需求名称或迭代标识。需求完成后即可执行，无需等待合入主分支；若归档前当前分支又有人工改动，归档仍必须以运行时锁定的最新 `HEAD` 作为知识库与报告基线。

补充规则：

- 归档前必须校验 `ai_commit_hash` 是否能被当前仓库 `git rev-parse --verify --quiet` 解析
- 若 `ai_commit_hash` 不可解析，报告中的 `AI 代码采纳率` 必须写 `—` 并说明"缺少有效 commit 基线"，**禁止**误写成 `0%`

## 计时规范

遵循 `rules/common/timing-spec.md`。步骤定义：

| 步骤编号 | 步骤名称 |
|---------|---------|
| S1 | OpenSpec 归档（openspec-archive-agent，可选） |
| S2 | 校验 AI commit + 锁定分支代码快照 |
| S3 | 知识库更新（kb-update-agent） |
| S4 | 归档报告生成（archive-report-agent） |
| S5 | Instinct 提取（instinct-extract-agent，后台非阻塞） |

报表子章节：`### /04-archive 耗时报表`。S5 为后台步骤，合计不含 S5。
