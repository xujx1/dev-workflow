---
description: Doctor 诊断命令。执行健康检查，诊断配置、状态、产物、权限等问题，生成诊断报告。
argument-hint: [--full | --quick | --focus config|state|artifacts|permission|plugins|all]
---

# /doctor — 诊断命令

> 传统斜杠命令兼容入口。实际诊断逻辑在 `.workflow/scripts/doctor.js`。

## 说明

执行 dev-workflow 健康检查，诊断以下问题：

| 检查项 | 分类 | 说明 |
|--------|------|------|
| 配置文件 | config | `.mrd-to-code-config.json` 存在性、合法性 |
| 执行状态 | state | `execution-state.md` 格式、字段完整性 |
| 关键产物 | artifacts | 按当前 Stage 判断所需产物存在性 |
| Beads 一致性 | consistency | 任务状态与 execution-state 一致性 |
| 飞书权限 | permission | MCP scope 是否满足当前 Stage |
| 插件版本 | plugins | OpenSpec/GitNexus/Beads 版本可用性 |
| 知识库新鲜度 | knowledge | Freshness Score 是否低于阈值 |
| 模型路由 | model | baseline 配置是否可用 |

## 调用方式

```bash
# 快速检查
mrd doctor
node .workflow/scripts/doctor.js

# 完整报告（生成 .workflow/doctor-report.md）
mrd doctor --full
node .workflow/scripts/doctor.js --full

# 聚焦检查
mrd doctor --focus config
mrd doctor --focus permission
```

## 参数

| 参数 | 说明 |
|------|------|
| `--full` | 生成完整诊断报告并写入 `.workflow/doctor-report.md` |
| `--quick` | 快速检查模式（默认），仅输出控制台摘要 |
| `--focus <item>` | 聚焦特定检查项：`config` / `state` / `artifacts` / `permission` / `plugins` / `all` |

## 输出状态

| 状态 | 含义 | 后续动作 |
|------|------|---------|
| `pass` | 所有检查通过 | 无需操作 |
| `warn` | 存在风险但不阻断 | 查看建议，按需处理 |
| `block` | 发现阻断性问题 | 必须修复后才能继续 |
| `autofix_done` | 问题已自动修复 | 确认修复结果 |

## 触发时机

| 场景 | 触发方式 |
|------|---------|
| 每个 Stage 开始前 | Orchestrator 自动调用 `doctor-check.js` |
| 初始化完成后 | `00-init` 最后一步自检 |
| 插件升级后验证 | `mrd-upgrade` 后自动触发 |
| 用户主动诊断 | `mrd doctor` 或 `mrd doctor --full` |

## 产出

| 文件 | 路径 | 说明 |
|------|------|------|
| 诊断报告 | `.workflow/doctor-report.md` | 仅 `--full` 模式生成 |
| 审计日志 | `.workflow/ops-audit.log` | 追加诊断记录 |

## 计时规范

遵循 `rules/common/timing-spec.md`。步骤定义：

| 步骤编号 | 步骤名称 |
|---------|---------|
| S1 | 证据收集（配置、状态、产物） |
| S2 | 诊断检查执行 |
| S3 | 报告生成（仅 --full） |

报表子章节：`### /doctor 耗时报表`。

## 示例

```bash
$ mrd doctor

=== Doctor Quick Check ===

[PASS] 配置文件: .mrd-to-code-config.json 合法
[WARN] 执行状态: execution-state.md 不存在
[PASS] 关键产物: PRD 和技术方案产物存在
[WARN] Beads 一致性: Beads 未初始化，任务追踪回退到 TodoWrite
[PASS] 飞书权限: 飞书权限满足当前 Stage 需求 (4 scopes)
[WARN] 插件版本: OpenSpec 版本 1.2.0，最新为 1.4.0
[PASS] 知识库新鲜度: Freshness Score = 78（阈值 60）
[WARN] 模型路由: 模型路由未配置，已退化为 baseline 单模型模式

运行 `node .workflow/scripts/doctor.js --full` 生成完整报告
```
