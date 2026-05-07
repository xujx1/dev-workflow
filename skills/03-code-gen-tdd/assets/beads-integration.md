# Beads 任务追踪集成（03-code-gen-tdd）

> 当 `plugin_availability.beads.installed=true` 时启用，否则静默跳过。

## Phase 依赖声明（启动时一次性创建）

```bash
# 创建各 Phase issue
$BD_BIN create "Phase 1: 测试规格 + OpenSpec" --type task
$BD_BIN create "Phase 2: 实现代码" --type task
$BD_BIN create "Phase 3: Code Review" --type task
$BD_BIN create "Phase 4: 测试代码生成" --type task
$BD_BIN create "Phase 5: 测试执行与覆盖率" --type task

# 声明阻塞依赖（下游 blocks 上游）
$BD_BIN dep add <phase2-id> <phase1-id> --type blocks
$BD_BIN dep add <phase3-id> <phase2-id> --type blocks
$BD_BIN dep add <phase4-id> <phase3-id> --type blocks
$BD_BIN dep add <phase5-id> <phase4-id> --type blocks
```

## Phase 门禁

| 时机 | Beads 操作 | 说明 |
|------|-----------|------|
| Phase N 启动前 | `$BD_BIN ready` | 查询当前 unblocked 的 Phase；若目标 Phase 不在列表中 → 停下汇报阻塞原因 |
| Phase N 完成后 | `$BD_BIN update <id> --status done` | 标记完成，自动解除下游阻塞 |
| Phase N 失败 | `$BD_BIN update <id> --status blocked` | 标记阻塞，下游 Phase 无法启动 |

## 产出元数据写入

Phase 完成后，将产出摘要写入 Beads issue notes：

```bash
$BD_BIN update <phase-id> --notes '{"file":"req/foo/test_spec.md","size":"8KB","summary":"6个测试类/12个AC/覆盖3模块"}'
```

## 降级策略

Beads 不可用时，回退到 `execution-state.md` + Phase 门禁字段（`phase_gate_status` / `awaiting_user_confirmation_for`），LLM 自觉遵守 Phase 顺序。
