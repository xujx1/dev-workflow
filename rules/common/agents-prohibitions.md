# Orchestrator 禁止清单与 Phase 节奏控制

> 从 rules/common/agents.md 下沉：Orchestrator 禁止行为与 Phase 间节奏控制规则。

## Orchestrator 禁止清单（P0 Token 优化硬约束）

> ⚠️ **P0 硬约束**：为防止上下文爆炸，所有 Skill / Orchestrator 必须遵守以下禁止清单。

### 状态读取瘦身

1. **只读 `execution-state.md` 前 50 行摘要**：
   - 禁止读详细日志（`unit_test_report_*.md`、完整 code-review 报告）
   - 禁止一次性 Read ≥3 个知识库文件
   - 知识库注入总行数 ≤350 行

### 禁止清单

| 禁止项 | 原因 | 正确做法 |
|--------|------|---------|
| ❌ 禁止在主会话中生成代码/测试/Review | 专职 Agent 已存在 | 通过 `java-impl-agent`、`testcode-gen-agent`、`java-review-agent` 执行 |
| ❌ 禁止直接调用 `mvn test`、`mvn compile` 等构建命令 | Orchestrator 职责仅编排 | 由 `tdd-test-runner-agent` 执行 |
| ❌ 禁止一次性 Read ≥3 个知识库文件 | 上下文爆炸风险 | 先读 `_index.md` 摘要层，按需深挖 |
| ❌ 禁止连续推进 ≥3 个 Phase（即使 `--auto`） | 上下文爆炸风险 | 最多连续 2 个 Phase 后停下汇报，提示 `/compact` |

## Phase 节奏控制

| 节点 | 默认行为 | Token 优化要求 |
|------|---------|---------------|
| Phase 0→1 | 执行后**停下，等用户确认** | ✅ 已符合优化要求 |
| Phase 1 确认后 → Phase 2 | **执行 Phase 2，停下汇报** | 停下，写状态文件，提示 `/compact` |
| Phase 2→3 | 可连续执行（Review 较轻量） | ✅ 允许连续（最多 2 个 Phase） |
| Phase 3→4 | **停下汇报** | 停下，写状态文件，提示 `/compact` |
| Phase 4→5 | **停下汇报** | 停下，写状态文件，提示 `/compact` |
| Phase 3 BLOCK | **Phase 3 内部自动修复**（最多 3 轮）；3 轮后仍 BLOCK → 中断请求人工介入 | 内部闭环，不新增主会话上下文 |
| Phase 5 DoD 未达标 | **本轮只输出诊断，不自动跨 Phase 回溯** | 禁止自动修复链，等待下一轮 `--resume` |
| Phase 5 DoD 达标 | **停下汇报**，等用户确认后进 Phase 6 | ✅ 已符合优化要求 |

## 验证命令

每次执行前，可通过以下命令验证注入行数：

```bash
# 统计知识库注入总行数
wc -l app-knowledge-base/**/*.md | tail -1

# 若总行数 > 350 行，需要精简或分批注入
```
