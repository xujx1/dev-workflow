# Execution State - SIM_05: Reconcile Beads State Mismatch

## 元数据
- simulation_id: SIM_05
- description: reconcile 发现 Beads 任务已关闭但 execution-state 显示 in-progress，reconcile 报告生成 warn

## 当前状态
current_stage: stage03_phase4
last_completed_phase: phase3
next_phase: phase4

## Beads 状态（来自 Beads 系统）
beads_state:
  phase4_task:
    id: "bd-12345"
    status: "done"  # Beads 中已关闭
    closed_at: "2024-01-15T11:00:00Z"
    closed_by: "user"

## Execution State 记录
execution_state_recorded:
  phase4_task:
    id: "bd-12345"
    status: "in_progress"  # Execution State 仍显示进行中

phase4:
  status: in_progress
  started_at: "2024-01-15T10:00:00Z"

## Reconcile 结果
reconcile_result:
  inconsistencies_found: 1
  details:
    - type: "status_mismatch"
      task_id: "bd-12345"
      beads_status: "done"
      execution_state_status: "in_progress"

## 配置
feature_dir: "req/order-feature"
project_root: "/Users/admin/workspace/my-app"
