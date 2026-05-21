# 技术方案：Harness 自身回归测试

## 背景

dev-workflow Harness 已经不是简单的提示词集合，而是一套包含 Skill、Agent、Rules、State 协议、产物契约和停止条件的工程系统。随着功能不断迭代，缺少自身的回归测试体系，存在以下风险：

1. Skill / Agent 改动后，流程协议（输入、产物、状态更新）可能被悄悄破坏。
2. 插件版本自动更新没有安全网，无法保证"更新可控"。
3. 新功能上线无法验证 resume、reconcile、停止条件等关键行为是否仍然正确。

## 目标

1. 建立三层回归测试体系：L1 静态契约测试、L2 流程模拟测试、L3 端到端测试。
2. 第一阶段优先落地低成本的 L1 + L2，保证流程协议不被改坏。
3. L3 端到端测试作为后续增强，用固定 example 需求验证 golden path / failure path / resume path。
4. 回归测试与插件版本更新机制集成，更新前自动运行，失败时阻止自动更新。

---

## 方案设计

### 三层测试体系

```
L1 静态契约测试（优先落地）
  目标: 验证 Skill / Agent / Rules 是否满足基本协议约束
  测试内容:
    - Skill contract test：输入字段、必需产物、状态更新字段、权限边界
    - Agent fixture test：固定输入下关键输出字段是否存在且合法
  执行方式: 静态分析 + 规则检查脚本（不需要真实 LLM 调用）
  执行时间: < 30s

L2 流程模拟测试（优先落地）
  目标: 验证 Orchestrator 在各种异常状态下的行为是否符合预期
  测试场景:
    - execution-state 伪造为各阶段（模拟 resume 各节点）
    - 产物缺失（模拟关键产物不存在时 Orchestrator 是否正确 block）
    - Beads 状态不一致（模拟 reconcile 报告是否生成）
    - 模型配置缺失（模拟 baseline 退化是否触发）
    - 自动修复连续失败（模拟 STOP_01 是否正确触发）
  执行方式: 用构造好的 execution-state.md + 伪造产物运行 Orchestrator 并检查输出
  执行时间: < 2min

L3 端到端测试（后续增强）
  目标: 用固定 example 需求验证完整流程行为
  测试场景:
    - golden path：完整跑通一个 example 需求，验证所有产物存在且格式正确
    - failure path：缺文件/权限失败/覆盖率不足时流程正确停下
    - resume path：模拟上下文中断后能否正确恢复到中断点继续执行
  执行方式: 真实 LLM 调用（成本较高，建议只在版本发布前运行）
  执行时间: 10~30min（视 example 规模）
```

### L1 静态契约测试内容

每个 Skill 应满足以下契约，通过脚本自动检查：

```yaml
# skill-contract.schema.yaml（合成示例）
skill_name: "03-code-gen-tdd"
required_inputs:
  - execution_state.current_stage
  - project.tech_stack
required_outputs:
  - implementation/*.java
  - test/*.java
  - execution_state.code_gen_status
state_update_fields:
  - code_gen_status
  - autofix.attempts
  - autofix.status
permission_boundary:
  forbidden_operations:
    - "write business PRD"
    - "make architecture decisions without user input"
```

检查脚本扫描 `skills/` 目录下所有 SKILL.md，提取关键字段并对比 schema 约束。

### L2 流程模拟测试场景

| 场景 ID | 输入状态 | 预期行为 |
| --- | --- | --- |
| SIM_01 | execution-state 显示 Stage 02 完成，产物存在 | Orchestrator 直接跳到 Stage 03 |
| SIM_02 | execution-state 显示 Stage 02 完成，但 PRD 产物缺失 | pre-stage doctor 返回 block，提示重跑 Stage 02 |
| SIM_03 | autofix.attempts = max_attempts | autofix loop 停止，返回 FAILED_MAX_ATTEMPTS |
| SIM_04 | model_routing 未配置 | 退化为 baseline 单模型，输出一次 warn |
| SIM_05 | reconcile 发现 Beads 任务已关闭但 execution-state 显示 in-progress | reconcile 报告生成 warn，提示人工确认 |

### 测试目录结构

```
.workflow/tests/
├── L1-contracts/
│   ├── skill-contract.schema.yaml    # Skill 契约定义
│   ├── check-contracts.js            # 契约检查脚本
│   └── reports/
│       └── contract-check-report.md  # 检查结果报告
├── L2-simulations/
│   ├── fixtures/
│   │   ├── sim-01-resume-stage03/
│   │   │   ├── execution-state.md    # 伪造状态
│   │   │   └── expected-output.yaml  # 预期行为
│   │   └── sim-02-missing-prd/
│   │       ├── execution-state.md
│   │       └── expected-output.yaml
│   └── run-simulations.js            # 流程模拟执行脚本
└── L3-e2e/
    ├── examples/
    │   └── order-feature-example/    # 固定 example 需求
    └── run-e2e.sh                    # 端到端测试脚本（发布前运行）
```

### 与版本更新集成

插件版本自动更新前自动运行 L1 + L2 测试：

```bash
# 更新前钩子（伪代码）
pre-upgrade-hook:
  run: node .workflow/tests/L1-contracts/check-contracts.js &&
       node .workflow/tests/L2-simulations/run-simulations.js
  on-failure: block-upgrade
  on-success: proceed-with-upgrade
```

若 L1 或 L2 任一测试失败，阻止自动更新，输出失败报告，等待人工确认。

### Harness 自身开发流程

Harness 自身的 Skill / Agent / Rules 改动可以走 `nano` 档位的 dev-workflow：

- 改动 Skill 文件 → 触发 L1 契约检查
- 改动 Orchestrator 行为 → 触发 L2 流程模拟
- 发版前 → 触发 L3 端到端（可选，成本高时跳过）

---

## 文件变更清单

| 文件 | 变更说明 |
| --- | --- |
| `.workflow/tests/L1-contracts/skill-contract.schema.yaml` | 新增，Skill 契约定义 |
| `.workflow/tests/L1-contracts/check-contracts.js` | 新增，契约检查脚本 |
| `.workflow/tests/L2-simulations/fixtures/` | 新增，流程模拟测试 fixtures |
| `.workflow/tests/L2-simulations/run-simulations.js` | 新增，流程模拟执行脚本 |
| `.workflow/tests/L3-e2e/` | 新增（后续增强），端到端测试框架 |

---

## 验收标准

1. L1 契约检查：所有 Skill 满足 schema 约束时输出 pass；违反约束时输出具体 Skill 名称和违反字段。
2. L2 流程模拟：所有 5 个基础场景（SIM_01 ~ SIM_05）预期行为与实际一致。
3. 插件版本更新前，L1 + L2 测试自动运行，失败时阻止更新。
4. 测试执行成本：L1 < 30s，L2 < 2min（不依赖真实 LLM）。

---

## 风险与注意事项

1. **L3 成本控制**：端到端测试需要真实 LLM 调用，成本较高。建议只在重大版本发布前运行，日常迭代只跑 L1 + L2。
2. **契约覆盖率**：第一阶段只覆盖核心 Skill（01/02/03/04），其他 Skill 契约逐步补充。
3. **误阻断风险**：L2 模拟测试中伪造状态可能不完整，导致误报。建议允许在日志中手动跳过特定场景，减少误阻断。
