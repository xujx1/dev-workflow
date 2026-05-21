# Execution State - SIM_03: Autofix Max Attempts

## 元数据
- simulation_id: SIM_03
- description: autofix.attempts = max_attempts，autofix loop 停止，返回 FAILED_MAX_ATTEMPTS

## 当前状态
current_stage: stage03_phase5
last_completed_phase: phase5
next_phase: null

## Autofix 状态
autofix:
  attempts: 3
  max_attempts: 3
  status: in_progress
  last_attempt_at: "2024-01-15T11:45:00Z"
  last_error: "Test compilation failed: cannot find symbol 'OrderService'"

## 阶段状态
phase5:
  status: failed
  failure_reason: "autofix_exhausted"
  coverage: 45.2
  target_coverage: 80.0
  test_retry_count: 3
  coverage_retry_count: 3

## 配置
feature_dir: "req/order-feature"
project_root: "/Users/admin/workspace/my-app"
