# Harness 自身回归测试

本目录包含 dev-workflow Harness 的三层回归测试体系。

## 目录结构

```
.workflow/tests/
├── package.json              # 依赖配置
├── pre-upgrade-hook.sh       # 版本更新前钩子
├── L1-contracts/             # L1 静态契约测试
│   ├── skill-contract.schema.yaml
│   ├── check-contracts.js
│   └── reports/
├── L2-simulations/           # L2 流程模拟测试
│   ├── fixtures/
│   └── run-simulations.js
└── L3-e2e/                   # L3 端到端测试（预留）
```

## 三层测试体系

| 层级 | 目标 | 执行时间 | 依赖 LLM |
|------|------|----------|----------|
| L1 | 验证 Skill/Agent/Rules 契约约束 | < 30s | 否 |
| L2 | 验证 Orchestrator 异常行为 | < 2min | 否 |
| L3 | 验证完整流程（预留） | 10~30min | 是 |

## 快速开始

```bash
# 安装依赖
cd .workflow/tests
npm install

# 运行 L1 契约测试
npm run test:L1

# 运行 L2 流程模拟测试
npm run test:L2

# 运行全部测试
npm run test:all
```

## 版本更新集成

插件版本自动更新前会运行 `pre-upgrade-hook.sh`：

```bash
./pre-upgrade-hook.sh
```

- L1 或 L2 任一失败 → 阻止更新
- 全部通过 → 继续更新

## L1 契约测试

验证每个 Skill 是否满足基本协议约束：

- 必需的 frontmatter 字段（name, version, description）
- 必需的章节结构
- Skill 特定约束（必需 agents、状态更新字段、禁止操作）

报告输出：`L1-contracts/reports/contract-check-report.md`

## L2 流程模拟测试

验证 Orchestrator 在各种异常状态下的行为：

| 场景 | 描述 |
|------|------|
| SIM_01 | Stage 02 完成 + 产物存在 → 直接跳 Stage 03 |
| SIM_02 | PRD 产物缺失 → block 并提示重跑 |
| SIM_03 | autofix 达到最大次数 → 停止循环 |
| SIM_04 | model_routing 未配置 → 降级 baseline |
| SIM_05 | Beads 与 execution-state 不一致 → warn |

报告输出：`L2-simulations/reports/simulation-report.md`

## L3 端到端测试（预留）

用固定 example 需求验证完整流程行为：

- golden path：完整跑通
- failure path：正确停下
- resume path：正确恢复

建议只在版本发布前运行。

## 验收标准

1. ✅ L1 契约检查：所有 Skill 满足 schema 约束时输出 pass
2. ✅ L2 流程模拟：5 个场景预期行为与实际一致
3. ✅ 插件版本更新前，L1 + L2 测试自动运行
4. ✅ 测试执行成本：L1 < 30s，L2 < 2min
