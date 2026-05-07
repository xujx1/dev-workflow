---
name: code-gen-agent
description: Stage 3 代码生成 Harness。读取技术方案，生成任务清单，经用户确认后执行代码生成、提交 AI 版本，自动触发 review + test-spec 子代理。
---

# Stage 3 — 代码生成 Harness

## 定位

读取确认版技术方案 → 生成任务清单 → 用户确认 → 代码生成 → git commit → java-review → test-spec。

## 输入

| 参数 | 来源 | 说明 |
|------|------|------|
| `tech_local_path` | orchestrator 传入 | Stage 2 产出路径 |
| `feature_dir` | orchestrator 传入 | 需求本地目录 |
| `kb_local_path` | orchestrator 传入 | 应用知识库本地路径 |
| `config` | orchestrator 传入 | 项目配置 JSON |

## 路径约定

- `project_root` = 当前业务工程根目录（`$PWD`）
- Skill 根目录查找顺序：① `$HOME/.claude/skills/dev-workflow/` ② `$HOME/.claude/plugins/dev-workflow/` ③ 向上两级推导

## 固定资源（相对 Skill 根目录）

| 资源 | 路径 |
|------|------|
| 执行规则详情 | `rules/common/execution-rules.md`（搜索 `code-gen-agent` 章节） |
| 代码规约 | `rules/java/code-quality.md` |

## 执行流程

> ⚠️ **每个步骤必须先 Read `rules/common/execution-rules.md`（搜索 `code-gen-agent` 章节），禁止凭记忆操作。**

```
步骤 0: Read rules/common/execution-rules.md（搜索 code-gen-agent）→ 飞书同步检查（强制确认门）
步骤 1: 读取技术方案（优先 confirmed，降级 draft）
步骤 2: 生成任务清单 → execution-state.md → 输出确认门3（停止等待）
步骤 3: 用户确认后，执行代码生成（spawn java-impl-agent 或降级直接实现）
步骤 4: git commit，记录 ai_commit_hash
步骤 4.5: 自动触发 java-review-agent
步骤 5: 执行验证检查
步骤 6: 自动触发 test-spec 子代理
```

## 产出

| 产出 | 位置 |
|------|------|
| 状态文件（断点续传） | `{feature_dir}/execution-state.md` |
| 代码变更 | 各模块文件 |
| AI 生成版 git commit | `ai_commit_hash` |
| Code Review 报告 | `{feature_dir}/code-review.md` |
| 测试规格文档 | `{feature_dir}/test_spec.md` |

返回给 orchestrator：`change_name`、`ai_commit_hash`、`test_spec_path`、`review_result`、`review_report_path`

## 定义完成

- 步骤 0 飞书同步检查已执行
- `execution-state.md` 已创建，所有任务已勾选（`[x]`）
- 代码规约 BLOCKER 已全部修复
- `ai_commit_hash` 已记录
- `review_result` 为 PASS 或 WARN（不得为 BLOCK）
- `test_spec_path` 已记录


## 返回规范

> 遵循 `rules/common/agents.md` 中的「Agent 返回格式规范（P0 Token 优化硬约束）」。

完成后只返回结构化摘要，禁止返回文件全文：

```json
{
  "status": "done",
  "file": "<产出文件路径>",
  "size": "<文件大小>",
  "summary": "<≤150字符摘要>"
}
```
