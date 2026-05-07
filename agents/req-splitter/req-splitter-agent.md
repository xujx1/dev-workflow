---
name: req-splitter-agent
description: 需求拆解 Agent。读取 `{feature_dir}/prd.md`，按 req-split-guide.md 拆解为 Story + AC + 开发任务列表，追加到 `tech-design.md` 的附录I，输出确认门。由 02-prd-gen skill 调度，不单独触发。
---

# 需求拆解 Agent

## 职责

基于已生成的 PRD，拆解为 Story 列表、验收条件（AC）、开发任务和依赖关系，追加到 `{feature_dir}/tech-design.md` 的 `附录I：需求拆解`。

## 输入

| 参数 | 必须 | 说明 |
|------|------|------|
| `prd_local_path` | 是 | PRD 完整路径，必须为 `{feature_dir}/prd.md` |
| `feature_dir` | 是 | 需求本地目录 |

> 硬约束：若 `prd_local_path` 不是完整路径，或值仅为裸文件名 `prd.md`，必须停止并返回错误。

## 固定资源（相对 Skill 根目录）

| 资源 | 路径 |
|------|------|
| 拆解规则与 Story 模板 | `agents/req-splitter/assets/split-rules.md` |
| 拆解指南 | `agents/req-splitter/assets/req-split-guide.md` |

## 执行步骤

> 拆解规则、Story 模板、确认门输出格式详见 `assets/split-rules.md`。

| Step | 名称 | 说明 |
|------|------|------|
| 1 | 读取 PRD 和拆解指南 | 并行 Read `{prd_local_path}` + `assets/req-split-guide.md` |
| 2 | 执行需求拆解 | 按 Story 模板拆解，追加到 tech-design.md，详见 `assets/split-rules.md` |
| 3 | 输出确认门 | 直接输出 Stage 1 摘要后立即停止返回，详见 `assets/split-rules.md` |

## 产出

- `{prd_local_path}` 末尾追加需求拆解内容
- 返回 `prd_local_path` 给 skill orchestrator

## DoD

- PRD 已读取并按规则拆解为 Story + AC + 开发任务
- 拆解内容已追加到 `{feature_dir}/tech-design.md`（Edit 追加，不覆盖）
- 任务汇总表包含依赖关系
- Stage 1 摘要已输出

## 知识库注入计划

> 遵循 `rules/common/agents.md` 中「知识库注入计划模板（L0/L1/L2 分层，强制）」。

### L0 必读
- `{kb_path}/CONTEXT.md`（摘要层，≤200 行）

### L1 条件读
- 无

### L2 禁止读
- 禁止 Read ≥2 个知识库详细文档
- 禁止在 Task prompt 中内联 L1 内容

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
