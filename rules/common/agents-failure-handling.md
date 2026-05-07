# 专职 Agent 派发失败处理（硬约束）

> 从 rules/common/agents.md 下沉：派发失败的完整处理流程。

只要某一步声明了专职 Agent，必须先完成 **路径解析 → spawn → 阻塞等待 → 产物校验**。

## 统一降级协议

`primary_dispatch -> serial_retry -> fail_stop`

| 阶段 | 说明 |
|------|------|
| `primary_dispatch` | 按当前 Skill 设计的原始派发方式执行（可能是单 agent，也可能是并行多 agent） |
| `serial_retry` | 若原始派发失败，则退化为**串行逐一真实 spawn**；仅允许继续使用 `Task/Subagent` 调度，不允许主会话直接扮演该 Agent |
| `fail_stop` | 若串行重试后仍失败，必须停止在当前 Phase，不得越权推进 |

## 禁止行为

若出现 `agents/...` 路径不存在、Task/子 Agent 启动失败、返回为空、或预期产物未落盘，**不得**改由主 Agent / orchestrator 直接代做该步骤。

## 正确处理顺序

1. 重新按约定路径顺序解析 Agent（`config.agents.agents_dir` → `{project_root}/.claude/agents/` → `$HOME/.claude/plugins/dev-workflow/agents/`）
2. 先执行 `primary_dispatch`
3. 若失败，则至少进行一次 `serial_retry`，并在 prompt 中显式声明"严格阻塞等待"
4. 若仍失败，将当前步骤标记为 `agent_dispatch_failure`，把失败的 Agent、解析路径、错误摘要写入 `{feature_dir}/execution-state.md`，并停止在当前 Phase，等待人工处理

## 不可重试场景

以下场景**不属于**可重试的串行降级范围，应直接进入 `fail_stop`：

- Agent 文档或固定资源路径缺失
- 当前步骤的输入契约缺失（如必需文件、必需参数不存在）
- 预期正式产物路径本身无法判定

## 状态文件记录

状态文件至少应记录：

- `resolved_agent_path`
- `dispatch_mode`（如 `primary_dispatch` / `serial_retry`）
- `dispatch_attempt`
- `dispatch_status`（如 `success` / `retrying` / `failed`）
- `dispatch_failed_agent`
- `dispatch_error_summary`

上述规则同样适用于 `java-impl-agent`、`java-review-agent`、`testcode-gen-agent`、`tdd-test-runner-agent`；**禁止**以"子 Agent 起不来"为由跳过、降级或主会话代执行。
