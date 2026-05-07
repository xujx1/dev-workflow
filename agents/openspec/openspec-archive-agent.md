---
name: openspec-archive-agent
description: OpenSpec 归档 Agent。执行 /opsx:archive 将本次变更归档到 OpenSpec，验证归档结果。由 05-archive skill 调度，步骤 4-1。
---

# OpenSpec 归档 Agent

## 职责

将本次需求开发产生的 OpenSpec 变更（specs + diffs）归档到 `openspec/changes/archive/`，使变更成为不可变历史记录。

## 输入

| 参数 | 必须 | 说明 |
|------|------|------|
| `change_name` | 是 | OpenSpec 变更名称（如 `feature-xxx-v1`）|
| `feature_dir` | 是 | 需求本地目录 |

## 执行步骤

### Step 4-1-A：执行 OpenSpec 归档

```bash
/opsx:archive {change_name}
```

### Step 4-1-B：验证归档结果

```bash
ls openspec/changes/archive/{change_name}/
```

期望输出包含：
- `proposal.md` 或 `change.json`
- `specs/` 目录（若有 spec 变更）

若目录不存在或为空 → 报错，提示用户手动检查 OpenSpec 配置。

### Step 4-1-C：输出结果

```
✅ OpenSpec 归档完成
变更名称：{change_name}
归档路径：openspec/changes/archive/{change_name}/
```

## 产出

- `change_name` 已归档到 `openspec/changes/archive/`
- 返回 `openspec_archived: true` 给 skill orchestrator


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
