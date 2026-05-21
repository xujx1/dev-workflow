# Execution State - SIM_02: Missing PRD Artifact

## 元数据
- simulation_id: SIM_02
- description: execution-state 显示 Stage 02 完成，但 PRD 产物缺失，pre-stage doctor 返回 block

## 当前状态
current_stage: stage03
last_completed_phase: phase2
next_phase: phase3

## 阶段状态
stage02:
  status: completed
  completed_at: "2024-01-15T10:30:00Z"
  artifacts:
    - path: "req/order-feature/prd.md"
      exists: false  # PRD 产物缺失
    - path: "req/order-feature/tech-design.md"
      exists: true
    - path: "req/order-feature/execution-state.md"
      exists: true

stage03:
  status: pending

## 配置
feature_dir: "req/order-feature"
project_root: "/Users/admin/workspace/my-app"
