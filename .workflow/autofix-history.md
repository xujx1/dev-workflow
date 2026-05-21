# 自动修复历史记录

> 本文件记录每次自动修复尝试的详细信息，用于问题追溯和人工介入时的上下文参考。
>
> **写入时机**：每次修复尝试完成后由 orchestrator 追加记录。
>
> **文件路径**：`{feature_dir}/.workflow/autofix-history.md`

---

## 修复会话信息

| 字段 | 值 |
|------|----|
| feature_dir | |
| feature_name | |
| 起始时间 | |
| 当前状态 | RUNNING |
| 停止原因 | — |

---

## 修复尝试记录

<!-- 每次修复尝试后追加以下格式的记录 -->

<!--
## 修复尝试 #1 (2026-05-21T10:00:00Z)

- 触发阶段: Phase 2 (实现代码)
- 失败测试/编译: 3 个 (OrderServiceTest, PaymentServiceTest, InventoryServiceTest)
- 修复操作: 修改 OrderService.calculateDiscount 的边界条件判断
- 修复结果: 失败测试 → 2 个（减少 1 个）
- 新增失败: 0 个
- 状态: RUNNING（继续）

-->

---

## 统计摘要

| 指标 | 值 |
|------|----|
| 总尝试次数 | 0 |
| 成功次数 | 0 |
| 失败次数 | 0 |
| 回归测试引入数 | 0 |

---

## 停止条件触发记录

<!-- 当触发停止条件时，记录以下信息 -->

<!--
### STOP_03 - FAILED_REGRESSION (2026-05-21T10:45:00Z)

- 修复尝试 #: 3
- 新增失败测试: PaymentServiceTest.testRefund
- 修复前失败测试: OrderServiceTest.testDiscount (仍然失败)
- 建议操作:
  1. 查看修复历史: cat .workflow/autofix-history.md
  2. 手动回退最后一次修复: git diff HEAD~1
  3. 或调整测试预期: 如果测试逻辑本身有误
-->
