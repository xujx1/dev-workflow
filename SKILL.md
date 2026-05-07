---
name: mrd-to-code-v2
description: 一键研发全流程（Harness 版）：输入 MRD 飞书地址，自动顺序执行 MRD澄清 → PRD生成 → 技术方案 → OpenSpec（可选）→ 代码生成（含test_spec + 测试代码）→ 归档，在需要人工选择的阶段等待用户确认。当用户说"mrd to code"、"全流程"、"一键研发"、"从mrd生成代码"、"从需求到代码"、"生成代码"、"生成技术方案"、"归档"、"生成需求报告"时使用。
---

# MRD to Code v2 — 编排器

> 本文件是**纯编排器**，不含执行逻辑。执行逻辑分布在各阶段 Skill 的 `agents/` 中。
> 遇到不确定的行为，优先查阅 `docs/flow-contract.md` 和各阶段 Agent 文件。
>
> **目录结构**：`skills/`（主线 Skill + 辅助 TDD 入口）、`agents/`（原子 Agent，一目录一职责）、`rules/`（规范标准）、`hooks/`（自动化触发）、`plugins/`（按需插件）、`.claude-plugin/` + `.claude/skills/`（Plugin 封装入口）
>
> **推荐先装插件**：
> - 必装：先执行 `/plugin marketplace add https://github.com/affaan-m/everything-claude-code`
> - 必装：先执行 `brew install rtk`，安装后执行 `rtk init --global`
> - Hooks 缺失时可直接执行 `dev-workflow:hooks-setup`
> - 统一说明：`plugins/README.md`

```
MRD 地址
  │
  ├─ [Stage 0]   mrd-clarify             → ⚠️ 确认门0
  ├─ [Stage 0.5] app-router              → 识别涉及应用，产出 apps.json（单应用直通/多应用拆分）
  ├─ [Stage 1+2] skills/02-implementation-plan → 一次产出 PRD + 技术方案；PRD 上传飞书；技术方案本地就绪 → ⚠️ 确认门（等待产品评审 PRD）
  │               └─ PRD 无改动 → 直接进入 Stage 3；PRD 有改动 → 回复"PRD已确认" → 触发 MODE B（修订模式）刷新技术方案
  ├─ [Stage 2*]  skills/02-implementation-plan → MODE B（仅当 PRD 经飞书确认后有改动时触发）
  │               └─ 回读飞书确认版 PRD → 刷新 `tech-design.md` → ⚠️ 确认门2
  ├─ [Stage 2.5] plugins/openspec        → ⚠️ 可选确认门（需求估算 ≥ 5人日时提示；实际生成在 Stage 3 Phase 1）
  ├─ [Stage 3]   skills/03-code-gen-tdd → ⚠️ 确认门3
  │               ├─ Phase 0: 本地文件确认（`tech-design.md` 存在即直接使用）
  │               ├─ Phase 1: [并行] tdd-test-spec-agent（测试规格）+ openspec-archive-agent（接口 Spec，可选）→ 串行互 Review → 确认门
  │               ├─ Phase 2: java-impl-agent（实现代码）
  │               ├─ Phase 3: java-review-agent（Review，范围 = git diff "+" 行；必须读取 `agents/java-review/java-review-agent.md`）
  │               ├─ Phase 4: testcode-gen-agent（生成测试代码；必须读取 `agents/testcode-gen/testcode-gen-agent.md`）
  │               └─ Phase 5: tdd-test-runner-agent（测试执行 + 覆盖率诊断；必须读取 `agents/tdd-test-runner/tdd-test-runner-agent.md`）
  └─ [Stage 4]   skills/04-archive       → 需求完成后手动触发
```

---

## 前置准备（每次启动自动执行）

### E-0. 统一环境前置检查

在进入 Stage 1 / Stage 2 / Stage 3 之前，统一执行：

- 检查 `.mrd-to-code-config.json` 中 `plugin_availability` 标志位，确认插件已安装。若未安装，运行 `/dev-workflow:00-init`。

执行约束：已安装的增强能力自动启用；ECC / RTK / GitNexus / Autoresearch 缺失时提示运行 `/dev-workflow:00-init`；Hooks 缺失时提示但不阻塞主流程。

### E-1. Token 门禁检查（P0 硬约束）

每个 Stage 启动前必须执行 Token 门禁检查，防止上下文爆炸导致输出截断。

| 上下文使用率 | 动作 |
|-------------|------|
| < 60% | ✅ 正常继续 |
| 60% - 80% | ⚠️ 提示执行 `/compact` |
| > 80% | ❌ 停止执行，必须 `/compact` 后继续 |

阶段间检查点：Stage 0→0.5、0.5→1、1→2（关键）、2→3（关键）、每个 Phase 之间各检测一次。

### E-2. 读取项目配置

```bash
[ -f ".mrd-to-code-config.json" ] && echo "CONFIG_EXISTS" || echo "CONFIG_MISSING"
```

- 存在 → 读取，覆盖阶段模型和可变配置项
- 不存在 → 使用 `docs/defaults.md` 中的默认值，**不弹窗**，静默继续

### E-3. 知识库探测

在项目根目录探测本地知识库：命中 `docs/defaults.md#知识库探测关键词` 中关键词的子目录即为 `kb_local_path`。未命中时弹确认门。

#### E-3.1 知识库版本检测

检测已有知识库是否满足应用知识库5层文档格式。任一层级缺失 → 升级确认门（默认 `mode=lite`，只补缺失部分）。

### E-4. CLAUDE.md 引用写入

`kb_local_path` 确定后，检查并写入 `CLAUDE.md` 首行：`@${kb_local_path}/00_概览.md`（已包含则跳过）。

### E-5. 知识库注入策略（P0 硬约束，L0/L1/L2 分层）

> ⚠️ **禁止在 orchestrator 层全量注入知识库**，所有知识库读取必须在 Agent 内部按需执行。

| 层级 | 读取时机 | 读取范围 |
|------|---------|---------|
| Orchestrator | ❌ 禁止 | — |
| Agent 启动前 | ✅ 仅传路径参数 | `kb_local_path` 字符串 |
| Agent 内部 L0 | ✅ 必读 | `{kb_path}/CONTEXT.md`（摘要层，≤200 行） |
| Agent 内部 L1 | ✅ 条件读（按职责，最多 1 个） | 见 `rules/common/agents.md` L1 映射表 |
| Agent 内部 L2 | ❌ 禁止 | 禁止 Read ≥2 个详细文档 |

**强制约束**：Orchestrator 不得在 Task prompt 中嵌入知识库内容；所有 Agent 必须包含「知识库注入计划」小节；总注入 ≤350 行。

| Agent | L1 条件读 | 何时触发 |
|-------|----------|---------|
| prd-generator | `{kb_path}/01_业务与领域知识层.md` | 生成 PRD |
| tech-design | `{kb_path}/02_架构与设计层.md` | 生成技术方案 |
| java-impl | `{kb_path}/03_核心流程与逻辑层.md` | 生成代码 |
| testcode-gen | `{kb_path}/03_核心流程与逻辑层.md` | 生成测试 |
| tdd-test-spec | `{kb_path}/02_架构与设计层.md` | 生成测试规格 |
| java-review | 无（只读 git diff） | — |
| tdd-test-runner | 无（只读 test_spec） | — |

---

## 参数收集

| 参数 | 说明 | 必填 |
|------|------|------|
| `mrd_url` | MRD 飞书文档地址 | 从 MRD 启动时必填 |
| `feature_dir` | 需求本地目录（如 `req/foo`） | 从 Stage 2/3 直接启动时必填 |
| `stop_after` | 执行到指定阶段后停止（`prd`/`tech`/`code`） | 否 |
| `enable_mrd_clarify` | 是否执行 Stage 0，默认 true | 否 |
| `auto_proceed` | Stage 间确认门是否自动通过，默认 true | 否 |

`feature_dir` 推导规则（按优先级）：用户显式传入 → 当前分支名推导 → MRD 标题推导 kebab-case

**意图识别**（从用户输入推导 `stop_after` 和 `auto_proceed`）：

| 关键词 | stop_after | auto_proceed |
|--------|-----------|--------------|
| 只生成 PRD / 生成 PRD | `prd` | false |
| 生成技术方案 / 只要技术方案 | `tech` | false |
| 生成代码 / 只生成代码 | `code` | false |
| 全流程 / mrd to code / 走完所有流程 | 不填（全流程） | **true** |

---

## 模型路由表（默认值，可通过 .mrd-to-code-config.json 覆盖）

| 阶段 | 模型 | 说明 |
|------|------|------|
| Stage 0 MRD 澄清 | `sonnet` | 问答提炼 |
| Stage 1+2 PRD + 技术方案 | `sonnet` | 合并产出 |
| Stage 2* 技术方案修订（MODE B） | `sonnet` | 仅当 PRD 飞书确认后有改动时触发 |
| Stage 2.5 OpenSpec | `sonnet` | 可选确认门 |
| Stage 3A 代码生成 | `sonnet` | java-impl-agent |
| Stage 3 review | `sonnet` | java-review-agent |
| Stage 3B 测试代码 | `sonnet` | Phase 4，testcode-gen-agent |
| Stage 3 runner | `sonnet` | Phase 5，tdd-test-runner-agent |
| Stage 4 归档     | `haiku`  | 轻量整理 |

---

## 执行任务总览（每次启动必须先输出）

```
## MRD to Code v2 执行总览

MRD：{mrd_url}
知识库：{kb_local_path | "未找到，跳过"}
产出目录：{feature_dir}
MRD 澄清：{启用 | 跳过}
执行范围：{全流程 | 止于 Stage N}
OpenSpec：{启用（阈值≥{openspec_threshold}人日） | 禁用}
状态文件：{feature_dir}/execution-state.md

---
[ ] Stage 0：MRD 澄清
[ ] Stage 0.5：应用路由
[ ] Stage 1：PRD 生成
[ ] Stage 2：技术方案
[ ] Stage 2.5：OpenSpec（需求估算 ≥ {openspec_threshold}人日时自动触发）
[ ] Stage 3：代码生成
[ ] Stage 4：归档

当前进度：🚀 启动中...
```

---

## 阶段调度机制

每个阶段通过 `Task` 工具以独立子代理执行，实现上下文隔离、模型路由、状态传递。

- 子代理 prompt 构造规则 → `docs/orchestration/task-prompt-rules.md`
- 各 Stage 详细调度（Stage 0/1+2/2.5 Step/Task 调度、确认门内容） → `docs/orchestration/stage-dispatch.md`

---

## 状态持久化

每次阶段完成后，orchestrator 更新 `{feature_dir}/execution-state.md`。
格式见 `docs/state-protocol.md`。

会话中断后，用户可说「从技术方案继续 {feature-name}」，orchestrator 读取状态文件恢复执行。

### 持久记忆注入（P2 Token 优化）

需求启动时，orchestrator 从 `execution-state.md` 的「持久记忆」节读取跨需求偏好，注入到上下文：

- 每条 value 截断至 150 字符
- 总注入体积 ≤50 tokens
- 禁止在 Task prompt 中内联持久记忆全文，只传截断后的 key=value 对

---

## 全流程完成汇报

```
## 全流程完成 ✅

产出目录：{feature_dir}/
├── mrd/mrd-original.md
├── mrd/mrd-clarified.md（Stage 0 执行时）
├── prd/prd.md
├── tech-design/tech-design.md              ← Stage 2 AI 生成，用户确认版
├── test_spec.md                               ← Stage 3 Phase 1 与代码并行生成
├── spec/                                      ← Stage 3 Phase 1 产出（OpenSpec，需求估算 ≥ 阈值时）
├── code-review.md              ← Stage 3 自动生成
└── archive-report.md                          ← Stage 4 后

状态文件：{feature_dir}/execution-state.md
AI 生成 commit：{ai_commit_hash}
```
