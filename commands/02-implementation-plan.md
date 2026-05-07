---
description: 生成实施方案（PRD + 技术方案）。MODE A：从飞书 MRD 一次生成 PRD + 技术方案草稿；MODE B：PRD 经飞书确认后回写刷新技术方案。
argument-hint: [飞书 MRD URL | "PRD已确认"]
---

# /02-implementation-plan — 生成实施方案

实际工作流在 `skills/02-implementation-plan/SKILL.md`。

## 使用前提醒

本命令进入正式 Skill 前，先读取 `.mrd-to-code-config.json` 的 `plugin_availability` 字段。

| 标志位 | 影响能力 |
|--------|---------|
| `l3_gitnexus=available` | GitNexus 调用链分析，技术方案生成后自动调用 `gitnexus_impact` 生成附录II |
| `l4_autoresearch=available` | autoresearch 推理增强，技术方案生成后自动追加附录III/IV |

> 如需安装插件，请运行：`/dev-workflow:00-init`

## MODE A — 初始生成（PRD + 技术方案）

根据飞书 MRD 文档一次性产出：
- PRD（产品可读）：`{feature_dir}/prd.md`，自动上传飞书
- 技术方案（研发消费）：`{feature_dir}/tech-design.md`，仅本地
- 附录I（需求拆解）+ 附录II（GitNexus 影响分析）+ 附录III/IV（autoresearch）

触发词：「生成PRD」、「生成技术方案」、「生成实施方案」

## MODE B — PRD 确认回写（刷新技术方案）

PRD 经飞书产品确认并修改后，基于确认版重新生成技术方案：
- 从飞书回读确认版 PRD（直接作为输入，不落盘中间文件）
- 覆盖刷新 `{feature_dir}/tech-design.md`

触发词：「PRD已确认」、「技术方案修订」、「更新技术方案」

## 前置检查

调用前先检查 `app-knowledge-base/KB_FRESHNESS.md`，并读取 `.mrd-to-code-config.json` 中的 `kb_freshness.stale_after_months`（默认 `1`）：
- 若文件不存在，提示用户：`知识库已经{stale_after_months}个月没有更新，是否需要做增量梳理`
- 若"最近更新时间"距离当前已超过配置的保鲜周期，提示用户：`知识库已经{stale_after_months}个月没有更新，是否需要做增量梳理`
- 若用户确认需要，建议先执行 `/01-knowledge-base`
- 若用户明确跳过，再继续执行 `skills/02-implementation-plan/SKILL.md`

## 调用方式

应用 `skills/02-implementation-plan` 技能。

**参数**：`$ARGUMENTS` — 飞书 MRD URL（MODE A）或 "PRD已确认"（MODE B）。

## 计时规范

遵循 `rules/common/timing-spec.md`。

**MODE A 步骤：**

| 步骤编号 | 步骤名称 |
|---------|---------|
| S1 | 前置检查（知识库保鲜期校验） |
| S2 | 飞书 MRD 文档读取与解析 |
| S3 | PRD 生成与飞书上传 |
| S4 | 技术方案生成 |
| S5 | 附录生成（附录I / 附录II / 附录III/IV，按插件可用性） |

**MODE B 步骤：**

| 步骤编号 | 步骤名称 |
|---------|---------|
| S1 | 前置检查（知识库保鲜期校验） |
| S2 | 飞书确认版 PRD 回读 |
| S3 | 技术方案覆盖刷新 |

报表子章节：`### /02-implementation-plan 耗时报表`。