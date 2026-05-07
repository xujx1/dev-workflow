# 代码生成 TDD 验证检查清单

> 适用于 `skills/03-code-gen-tdd`（完整闭环：代码实现 + TDD 验证循环）

---

## Phase 1 验证（测试规格 / OpenSpec）

### 测试规格（tdd-test-spec-agent）

- `test_spec.md` 已生成（8 章结构完整）
- `tdd-test-spec-agent` 已被实际派发并阻塞等待完成，未由主会话代写
- 若首轮派发失败，已按 `primary_dispatch -> serial_retry -> fail_stop` 处理，而不是主会话代执行
- 章节1（需求分析）覆盖 MRD/PRD 业务意图
- 章节4（测试用例）包含 12 类场景（正向、异常、边界等）
- 覆盖率目标已标注（精确增量行覆盖率 ≥80%；全量/分支覆盖率仅作诊断参考）；不足时优先 `tdd-test-spec-agent(supplement-coverage)` 补 spec
- 若存在 `change-manifest-phase2.md` 或等价变更摘要，已完成 coverage intent 校验（关键新增入口 / 分支 / 字段 / 配置场景均有映射）
- 若触发 OpenSpec，Round 2 互 Review 已完成；未触发则确认门只展示 TEST_SPEC
- `execution-state.md` 已写入本阶段过程数据与主要 Read 路径，未回退为按环节命中摘要区块

---

## Phase 2 验证（实现代码）

- `java-impl-agent` 已被实际派发并阻塞等待完成，未由主会话代实现
- `execution-state.md` 已记录 `dispatch_mode` / `dispatch_attempt` / `dispatch_status`
- 无 BLOCKER（B1~B10）：无硬编码、无 TODO 残留、无 System.out.println
- 按技术方案中的 Story 逐一实现，未跳过任何 Story
- `phase2_change_manifest_path` 已写入状态文件
- `execution-state.md` 已推进到真实阶段，而非停留在 `phase1`

---

## Phase 3 验证（Review）

- `review_result` 为 PASS 或 WARN（不得为 BLOCK）
- `phase3` 收口 `mvn compile` 已通过（0 编译错误）
- `java-review-agent` 已被实际派发并阻塞等待完成，未由主会话代 Review
- 若启用了 review shard，并行启动失败时已立即退回单个 `java-review-agent` 串行 Review，而不是直接把 `phase3` 判失败
- BLOCK 问题已全部修复
- 本轮 Review 报告一次性包含 L0/L1 全量问题；若存在同文件低风险 L1，已在修 BLOCK 时一并评估
- Review 报告已写入 `{feature_dir}/code-review.md`

---

## Phase 4 验证（测试代码生成）

- 已完成调用链溯源（找到真实入口类）
- `testcode-gen-agent` 已被实际派发并阻塞等待完成，未由主会话代写测试
- 生成的测试类放在 `tdd/` 目录
- 未强制 Spring 容器 / 真实 DB / 真实 Redis
- 测试代码 `mvn compile` 通过
- `test_file_list` 中的覆盖点描述与真实测试代码一致，无入口级夸大描述

---

## Phase 5 验证（测试运行 + 诊断）

- 测试通过率 = 100%（0 失败，0 错误）
- `tdd-test-runner-agent` 已被实际派发并阻塞等待完成，未由裸 `mvn test` 或主会话代跑
- 精确增量行覆盖率 ≥ 80%
- `unit_test_report` 包含根因分类、失败用例摘要、Maven 次数、时延拆分
- 未因缺少本地服务 / 容器 被误判为环境阻塞
- 若发生 `runner_asset_failure`，已明确记录为工具链故障，且未误走 R2 / R3 / R4
- 若未达标，已将失败原因、根因分类与下一轮动作建议写入 `execution-state.md`
- 若达标，已将 `next_phase=phase6` 落盘

---

## Phase 6 验证（汇总提交）

- 最终 git commit 已执行（含实现代码 + 测试代码）
- `ai_commit_hash` 已写入 `{feature_dir}/execution-state.md`
- `last_completed_phase=phase6`
- Stage 3 状态已更新为 ✅ 完成

---

## 产出物检查

- `{feature_dir}/code-review.md` 已生成
- `{feature_dir}/test_spec.md` 已生成
- `{feature_dir}/test_file_list.md` 已生成
- `{feature_dir}/unit_test_report.md` 已生成
- `{feature_dir}/execution-state.md` 已更新（含恢复字段、Phase 记录、故障分类、耗时与 Maven 次数）
- 若存在派发失败，已写入 `failure_category=agent_dispatch_failure`，且流程已停在对应 Phase，未继续越权推进
- 若存在串行重试成功，状态文件或过程数据已明确标记为 `serial_retry` 成功，而非普通首轮成功