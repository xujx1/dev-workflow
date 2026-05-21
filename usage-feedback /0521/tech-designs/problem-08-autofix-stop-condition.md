# 技术方案：自动修复停止条件与 Agent 循环管控

## 背景

dev-workflow 的代码生成 + TDD 阶段支持自动修复循环：当测试失败时，Agent 自动尝试修复并重新运行测试。但实践中出现以下问题：

1. Agent 在某些失败模式下进入死循环，反复尝试相同的修复策略却无法收敛。
2. 没有明确的停止条件，循环次数无上限，导致 token 消耗失控。
3. 某些修复操作引入了新的失败，原有通过的测试开始失败（regression）。
4. 修复过程不透明，无法在会话结束后复盘失败原因。

## 目标

1. 定义明确的自动修复停止条件（成功条件 + 失败条件）。
2. 引入"修复尝试计数器"和"regression 检测"，触发停止条件时阻断循环。
3. 循环结束后生成修复报告，记录尝试历史和最终状态。
4. 支持配置最大尝试次数，允许项目级覆盖。

---

## 方案设计

### 停止条件定义

#### 成功停止条件（任意一条成立则停止，判定为成功）

- 所有测试通过（exit code = 0）
- 目标测试通过率达到 `min_pass_rate`（默认 100%，可配置）

#### 失败停止条件（任意一条成立则停止，判定为失败，等待人工介入）

| 条件 ID | 触发条件 | 说明 |
| --- | --- | --- |
| STOP_01 | 修复尝试次数 ≥ max_attempts（默认 3） | 防止无限循环 |
| STOP_02 | 连续 2 次修复后失败数量未减少 | 检测修复无效（死循环特征） |
| STOP_03 | 修复后新增失败测试数 > 0 | Regression 检测，修复引入新问题 |
| STOP_04 | 编译失败且连续 2 次未恢复 | 编译错误连续失败，无法进入测试 |
| STOP_05 | 单次修复耗时 > timeout（默认 5 分钟） | 超时保护 |

### 修复循环状态机

```
初始状态: RUNNING

RUNNING
  → (所有测试通过) → SUCCESS
  → (STOP_01 触发) → FAILED_MAX_ATTEMPTS
  → (STOP_02 触发) → FAILED_NO_PROGRESS
  → (STOP_03 触发) → FAILED_REGRESSION
  → (STOP_04 触发) → FAILED_COMPILE_ERROR
  → (STOP_05 触发) → FAILED_TIMEOUT
```

### 修复尝试记录

每次修复尝试后，在 `.workflow/autofix-history.md` 中追加记录：

```markdown
## 修复尝试 #3 (2026-05-21T10:30:00Z)

- 失败测试: 3 个 (OrderServiceTest, PaymentServiceTest, ...)
- 修复操作: 修改 OrderService.calculateDiscount 的边界条件判断
- 修复结果: 失败测试 → 2 个（减少 1 个）
- 新增失败: 0 个
- 状态: RUNNING（继续）
```

### execution-state 新增字段

```yaml
autofix:
  status: "FAILED_MAX_ATTEMPTS"
  attempts: 3
  max_attempts: 3
  last_fail_count: 2
  regression_count: 0
  stop_reason: "STOP_01: 达到最大尝试次数 3"
  history_path: ".workflow/autofix-history.md"
```

### 配置项

```json
{
  "autofix": {
    "max_attempts": 3,
    "timeout_minutes": 5,
    "min_pass_rate": 100,
    "stop_on_regression": true,
    "stop_on_no_progress_rounds": 2
  }
}
```

### 人工介入提示

触发失败停止条件后，输出结构化的人工介入提示：

```
[AUTOFIX STOPPED] 原因: STOP_03 - 修复引入 1 个新的失败测试

失败的测试:
  - 修复前存在: OrderServiceTest.testDiscount (仍然失败)
  - 修复后新增: PaymentServiceTest.testRefund (regression)

建议操作:
  1. 查看修复历史: cat .workflow/autofix-history.md
  2. 手动回退最后一次修复: git diff HEAD~1
  3. 或调整测试预期: 如果测试逻辑本身有误

继续执行前请手动确认: $BD_BIN resume --after-manual-fix
```

---

## 文件变更清单

| 文件 | 变更说明 |
| --- | --- |
| `.workflow/autofix-history.md` | 运行时生成，修复尝试历史 |
| `.mrd-to-code-config.json` | 新增 `autofix` 配置块 |
| `execution-state.md` | 新增 `autofix` 状态字段 |
| `skills/mrd-to-code-v2/skills/03-code-gen-tdd/SKILL.md` | 修复循环增加停止条件检测逻辑 |

---

## 验收标准

1. 修复尝试次数达到 `max_attempts` 时，循环停止，输出结构化人工介入提示。
2. 修复引入新失败时（regression），立即停止，不继续尝试。
3. 连续 2 轮失败数量未减少时，停止并提示"无进展"。
4. `.workflow/autofix-history.md` 记录每次修复尝试的完整信息。
5. `execution-state.md` 中 `autofix.status` 反映最终状态。

---

## 风险与注意事项

1. **max_attempts 设置过小**：某些真实修复需要多轮才能收敛，建议默认值 3 作为下限，复杂项目可设为 5。
2. **regression 误判**：若原有测试本身是 flaky test，可能在修复前后随机失败，触发误报。建议对 flaky test 做豁免标记。
3. **超时值**：timeout 应根据项目测试运行时间调整，测试套件很大的项目需适当放宽。
