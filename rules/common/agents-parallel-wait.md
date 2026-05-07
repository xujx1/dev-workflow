# 并行子 Agent 等待规则（强制）

> 从 rules/common/agents.md 下沉：并行/串行子 Agent 场景的阻塞等待语义。

> **背景**：部分模型（如 GLM-5）对 `Task` 工具的调度语义与 Claude 不同，
> 默认将 `Task` 调用视为 fire-and-forget，导致主 Agent 在子 Agent 未完成时提前继续执行。
> 本规则要求在所有并行/串行子 Agent 场景中明确声明阻塞等待语义。

## 规则 A：严格阻塞等待（Blocking Wait）

每次 spawn 子 Agent（`Task` 工具）后，**必须显式声明等待点**：

```
⚠️ 严格阻塞等待：必须等待本步骤中所有 Task 工具调用均返回结果后，
才能继续执行下一步骤。禁止在任何子 Agent 未完成时向用户输出内容
或执行后续操作。
```

## 规则 B：串行降级（Serial Fallback）

若模型不支持并行阻塞等待，或首轮并行派发失败，**必须声明串行降级策略**，明确指出执行顺序：

```
若模型不支持并行阻塞等待，则改为串行逐一执行：
先等 Agent 1 返回，再等 Agent 2 返回，再等 Agent 3 返回。
```

串行降级仍须满足：

- 每一步都是真实 `Task/Subagent` 派发，不是主会话代执行
- 每个 Agent 返回后都要先做产物校验，再启动下一个
- 任一 Agent 在串行重试后仍失败，则停止本轮，不得继续后续 Agent

## 规则 C：完成确认（Completion Verification）

子 Agent 返回后，**必须校验关键产出文件是否已写入**，而非仅依赖返回值：

```
汇合结果时检查每个 Agent 的关键产出文件是否存在：
- Agent 1：确认 {expected_output_path_1} 已写入
- Agent 2：确认 {expected_output_path_2} 已写入
若任一 Agent 产出缺失，记录失败原因并提示用户，不得跳过继续执行。
```

## 规则 D：派发清单持久化（Dispatch Manifest）

当并行 spawn ≥ 2 个子 Agent 时，**启动前必须写入派发清单**到状态文件，
以支持主 Agent 上下文中断后恢复（见 `docs/state-protocol.md#dispatch-manifest`）：

```
# 写入 {feature_dir}/execution-state.md 的 dispatch 块示例
## 子 Agent 派发清单（{stage-name}）
| Agent | 状态 | 预期产出 | 启动时间 |
|-------|------|---------|---------|
| app-knowledge-agent | 🔄 已派发 | app-knowledge-base/CONTEXT.md | {datetime} |
```

Agent 返回后将对应行状态更新为 `✅ 已完成` 或 `❌ 失败`。

## 适用场景

本规则适用于所有使用 `Task` 工具 spawn 子 Agent 的场景，包括但不限于：

| 场景 | 规则适用 |
|------|---------|
| 知识库三库并行生成（01-knowledge-base） | A + B + C + D |
| 技术方案生成（03-tech-design）| A + B + C + D |
| 测试规格 + OpenSpec 并行（04-code-gen-tdd Phase 1）| A + B + C + D |
| 测试运行与覆盖率诊断（04-code-gen-tdd Phase 5）| A + B + C + D |
| 多应用 sub-PRD 并行生成（02-prd-gen）| A + B + C |
| 知识库升级补全（mrd-to-code-v2 E-3.1）| A + B + C + D |
| 归档各步骤串行子 Agent（05-archive）| A + C |
