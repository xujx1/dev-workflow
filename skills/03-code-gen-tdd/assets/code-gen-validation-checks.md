# 代码生成验证检查

## 自动检查（子代理执行）

- [ ] `{feature_dir}/execution-state.md` 存在，且已写入 `last_completed_phase` / `next_phase` / `phase_gate_status`
- [ ] Stage 3 Phase 2 实现代码状态已更新，且 `phase2_change_manifest_path` 非空
- [ ] 代码规约检查（`rules/java/code-quality.md` B1-B10）已执行，无 BLOCKER
- [ ] `git commit` 已执行，`ai_commit_hash` 非空
- [ ] 3-0 飞书同步检查已执行

## 需人工确认（Phase 1 确认门）

- [ ] `test_spec` / OpenSpec（如有）摘要足以支持进入 Phase 2
- [ ] `awaiting_user_confirmation_for=phase2`、`phase_gate_status=pending` 已正确落盘
- [ ] 用户确认后会先写入 `phase_gate_status=confirmed` 再进入 Phase 2

## 验证未覆盖

- 代码功能正确性（需单元测试，使用 `unit-test-gen` skill）
- 集成测试（需联调环境）
- 性能测试
