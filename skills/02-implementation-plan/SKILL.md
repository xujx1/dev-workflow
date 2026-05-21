---
name: implementation-plan
version: v1.1.0
description: 生成实施方案（PRD + 技术方案）。支持多域模式：PRD 按领域聚合，技术方案按应用拆分，各应用保存所属域 PRD 副本。从 MRD 一次性产出 PRD + 技术方案并上传飞书。当用户说"生成PRD"、"生成需求文档"、"PRD生成"、"生成技术方案"、"出技术方案"、"生成实施方案"、"多应用PRD"、"跨域方案"时触发。需要先完成知识库梳理（入口1）。
user-invocable: true
---

# 生成实施方案（PRD + 技术方案）

## 模型路由集成

本 Skill 涉及多个 Stage，使用不同类别模型：

- **MRD 澄清**: `writing` 类别
- **技术方案**: `deep` 类别

解析方式：
```bash
# MRD 澄清阶段
node .workflow/scripts/model-resolver.js resolve 02-mrd-clarify

# 技术方案阶段（支持风险升级）
node .workflow/scripts/model-resolver.js resolve 02-tech-design --escalation=cross_domain

# 检查是否需要显示单模型提醒
node .workflow/scripts/model-resolver.js show-reminder 02-tech-design
```

记录模型使用并更新 execution-state：
```bash
node .workflow/scripts/model-resolver.js log 02-tech-design <model> deep
```

> **Skill 定义「按什么标准做」**；具体执行由多个专职 Agent 顺序完成。本 Skill 是**入口 2**，需先完成「梳理知识库」（入口 1）。
> 本地文件即确认版，用户可直接编辑 PRD/技术方案。**test_spec 在入口 4 生成，不在本阶段生成。**
> **必须产出首版研发工时预估**（技术方案草稿含可修改的"需求复杂度估算"附录，供 OpenSpec 阈值判断）。
> **多域模式**：MRD 涉及多域时自动触发领域路由，PRD 按域聚合、技术方案按应用拆分、各 app 各存所属域 PRD 副本。单域向下兼容。

---

> 双源验证模式详情 → `assets/dual-source-validation.md` | 配置文件自愈 → `assets/impl-plan-steps.md` Step -1

---

## 协同模型

> ⚠️ 每个 Step 严格阻塞执行。**Task 调度硬约束**：1) 禁止后台模式（run_in_background 必须 false）；2) 禁止 prompt 内联大文本（只传路径+元数据）；3) 禁止跳步。

### 执行流程概览

```
Step -1: 配置自愈 → Step 0: 知识库检测 → Step 0.5: 初始化状态 → Step 1: mrd-reader
→ Step 1.5-domain: domain-routing（多域时） → Step 1.5: mrd-clarify
→ Step 2: 并行 PRD + 技术方案（单域）或 Phase 2-A + 2-B（多域） → 确认门
```

> MODE A/B 详细调度流程 → `assets/impl-plan-steps.md`
> 确认门格式详情 → `assets/confirmation-gate.md`
> 过程数据落盘详情 → `assets/state-templates.md`
> 路径门禁详情 → `assets/path-gates.md`

---

## 输入参数

| 参数                   | 必须  | 说明                                       |
| -------------------- | --- | ---------------------------------------- |
| `mrd_url`            | 是*  | 飞书 MRD 地址（与 `mrd_clarified_path` 二选一）    |
| `mrd_clarified_path` | 是*  | 本地澄清版 MRD 路径（与 `mrd_url` 二选一；全流程默认使用此值）  |
| `feature_dir`        | 否   | 需求本地目录（默认 `req/{需求名}/`）                  |
| `kb_local_path`      | 否   | 应用知识库路径（默认 `app-knowledge-base/`）        |
| `feature_name`       | 否   | 需求名称（多域时用于构造各 app 的 feature_abs_path）    |
| `apps`               | 否   | 多域时可直接传入应用列表（逗号分隔绝对路径），跳过 app-router 自动探测 |

---

## 产出

| 文件           | 路径                                   | 说明                                                  |
| ------------ | ------------------------------------ |-----------------------------------------------------|
| 项目配置         | `.mrd-to-code-config.json`           | 由 `/dev-workflow:00-init` 初始化                       |
| MRD 原文       | `{feature_dir}/mrd-original.md`      | mrd-reader-agent 落盘                                 |
| MRD 澄清版      | `{feature_dir}/mrd-clarified.md`     | 提问问答后必须回写                                           |
| PRD           | `{feature_dir}/prd.md`               | 纯产品可读正文（一~七章），不含附录；已上传飞书                           |
| 技术方案 | `{feature_dir}/tech-design.md` | 正文 + 附录I~IV；已上传飞书 |
| 执行状态          | `{feature_dir}/execution-state.md`   | 需求状态记录                                              |
| PRD/技术方案（多域） | `{app}/req/{需求名}/prd.md`, `tech-design.md` | 各 app 各存一份；PRD 同域同内容，技术方案各 app 独立 |

---

## Stage 02 确认门硬校验

> ⚠️ 在展示 PRD/技术方案确认门之前，orchestrator 必须执行统一 gate。任一 `block` 不得展示确认门，必须修复产物或补充 fallback 记录后重跑。

```bash
node .workflow/scripts/validate-stage02-gates.js --feature-dir "{feature_dir}" --json
```

该 gate 强制覆盖：

- PRD 章节必须符合 `assets/prd-template.md` 的一~七结构。
- PRD 禁止附录、非 Mermaid 代码块、ASCII art、实现类/包名/方法符号、`❓` 标注。
- PRD 必须使用 Mermaid `flowchart`，并追加生成元数据尾注。
- 技术方案必须符合 `assets/tech-design-template.md` 或业务完整技术模板，并覆盖影响分析、测试策略、风险评估、工时预估。
- OpenSpec 触发后必须存在 `proposal.md`、`design.md`、`tasks.md`、`test_spec.md`。
- `execution-state.md` 必须记录复杂度分级、模型路由结果、飞书上传地址和回读校验结果（`feishu_readback`）。
- Beads / GitNexus 不可用时，必须在 `execution-state.md` 记录 fallback 方式。

### Agent Prompt 硬约束

调度 `prd-generator-agent` 时必须传入：

```text
template_path=skills/02-implementation-plan/assets/prd-template.md
validation_rules_path=skills/02-implementation-plan/assets/prd-validation-checks.md
output_path={feature_dir}/prd.md
state_path={feature_dir}/execution-state.md
```

调度 `tech-design-agent` 时必须传入：

```text
template_path=skills/02-implementation-plan/assets/tech-design-template.md
full_template_path=agents/tech-design/assets/tech-design-template.md
output_path={feature_dir}/tech-design.md
state_path={feature_dir}/execution-state.md
gitnexus_mode=impact           # GitNexus 可用且涉及存量符号时必传
```

---

> 质量标准 → `assets/impl-plan-steps.md`

---

## 持久记忆（P2）

确认门选择后写入 `{feature_dir}/execution-state.md`「持久记忆」节。每条 value 截断至 150 字符；新需求启动时自动读取优先使用；注入时总体积 ≤50 tokens

| key | value | 来源 |
|-----|-------|------|
| prd_review_preference | {飞书确认版/本地确认版} | 确认门 |
| default_feishu_parent | {飞书上传路径} | 飞书上传 |

---

## Beads 任务追踪集成

> 当 `plugin_availability.beads.installed=true` 时启用，否则静默跳过。

```bash
$BD_BIN create "PRD 生成" --type task
$BD_BIN create "技术方案生成" --type task
$BD_BIN dep add <tech-design-id> <prd-id> --type blocks
```

状态：启动→`in_progress`，完成→`done`；确认门选择→写入持久记忆。Beads 不可用时回退到 `execution-state.md` 派发清单。

---

## autoresearch 接入（按需）

> 当 `l3_autoresearch=available` 时**无条件注入**，不依赖「信息不足」的主观判断。

| Agent | 固定注入值 | 调用方式 |
|-------|-----------|---------|
| tech-design-agent | `autoresearch_mode=fix` | `/autoresearch:fix` 查具体接口代码 |
| prd-gen-agent | `autoresearch_mode=scenario` | `/autoresearch:scenario` 补充业务场景 |
| tech-design-agent（tdd-spec 场景） | `autoresearch_mode=debug` | `/autoresearch:debug` 查现有测试模式 |

**调用格式**：在 tech-design-agent / prd-gen-agent 的 Task prompt 中追加：
```
autoresearch_mode=fix          # tech-design 场景
autoresearch_mode=scenario     # prd-gen 场景
autoresearch_mode=debug        # tdd-spec 参考现有测试场景
```
`l3_autoresearch=available` 时上述字段**强制传入**，Agent 内部按需实际调用 autoresearch，不影响主流程时序。

---

## GitNexus 接入（按需，变更影响分析）

> 当 `l2_gitnexus=available` 且技术方案涉及存量接口/核心链路改动时触发。

| 触发条件 | 调用方式 | 产出 |
|---------|---------|------|
| tech-design 涉及修改已有接口/方法 | `gitnexus_impact` 分析 blast radius | 技术方案「附录II：变更影响分析」 |
| tech-design 涉及新增被多处调用的核心类 | `gitnexus_query` 找调用链 | 影响范围 + 风险等级 |

**调用格式**：tech-design-agent 生成附录II时，若 `l2_gitnexus=available`，在 Task prompt 中追加：
```
gitnexus_mode=impact           # 变更影响分析
```
GitNexus 分析结果写入 `tech-design.md` 附录II，供 Phase 3 Code Review 消费。

---

## 复杂度分级

> 技术方案阶段自动判断需求复杂度档位，并写入 `execution-state.md`。

### 三档定义

| 档位 | 适用场景 | 流程差异 |
| --- | --- | --- |
| `nano` | 文案修改、字段命名、简单校验、小 if 分支 | tech-only + 单元测试；跳过知识库更新、OpenSpec、GitNexus、完整归档 |
| `lite` | 常规单应用需求、单模块改动 | 知识库 + 技术方案 + TDD；OpenSpec 可选，GitNexus 可选，标准归档 |
| `full` | 跨应用、高风险链路、多人协作需求 | 完整流程：OpenSpec 强制 + GitNexus 强制 + 完整归档 + 风险分析 |

### 档位判断规则

#### 规模维度

| 指标 | nano | lite | full |
| --- | --- | --- | --- |
| 预估人日 | < 0.5 | 0.5 ~ 3 | > 3 |
| 涉及文件数 | ≤ 3 | 4 ~ 15 | > 15 |
| 涉及应用数 | 1（局部改动） | 1 | > 1 |

#### 风险维度

| 风险类型 | 影响 |
| --- | --- |
| 涉及资金、库存、状态机 | 强制升级到 full |
| 涉及数据一致性（分布式事务） | 强制升级到 full |
| 涉及对外 API 接口变更 | 升级到 lite 或 full |
| 涉及权限边界变更 | 升级到 lite |

#### 协作维度

| 协作范围 | 影响 |
| --- | --- |
| 跨团队需求 | 升级到 full |
| 多应用需求 | 升级到 full |
| 单团队单应用 | 维持 lite |

### 档位升降级规则

**升级（宽松）**：
- 执行中发现风险比技术方案判断高（如发现跨应用依赖、高风险字段），可自动或由 Agent 提示后升级。
- 升级后追加对应流程节点（如触发 OpenSpec、启用 GitNexus）。

**降级（严格）**：
- 降级必须人工确认，不允许自动降级。
- 降级时 Agent 输出降级依据和潜在风险，等待用户确认后执行。

### 输出格式

技术方案阶段在 `execution-state.md` 写入：

```yaml
complexity:
  level: lite                      # nano / lite / full
  reasons:
    - single_app_change
    - estimated_days_1.5
    - no_external_contract_change
  risk_triggers: []
  collaboration_scope: single_team
  recommended_flow:
    knowledge_base: true
    openspec: optional             # true / optional / false
    gitnexus: optional             # true / optional / false
    archive: standard              # standard / full / skip
```

## 资产文件

详见 `assets/` 目录：`impl-plan-steps.md`、`dual-source-validation.md`、`confirmation-gate.md`、`state-templates.md`、`path-gates.md`、`recovery-rules.md`、`prd-template.md`、`prd-validation-checks.md`、`req-split-guide.md`、`tech-design-template.md`
