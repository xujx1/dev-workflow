---
name: implementation-plan
version: v1.1.0
description: 生成实施方案（PRD + 技术方案）。支持多域模式：PRD 按领域聚合，技术方案按应用拆分，各应用保存所属域 PRD 副本。从 MRD 一次性产出 PRD + 技术方案并上传飞书。当用户说"生成PRD"、"生成需求文档"、"PRD生成"、"生成技术方案"、"出技术方案"、"生成实施方案"、"多应用PRD"、"跨域方案"时触发。需要先完成知识库梳理（入口1）。
user-invocable: true
---

# 生成实施方案（PRD + 技术方案）

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
→ Step 3: openspec-verify-agent（OpenSpec 已初始化时）
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
| 技术方案 | `{feature_dir}/tech-design.md` | 正文 + 附录I~IV；已上传飞书；若已初始化 OpenSpec，同步生成 `openspec/changes/{需求名}/design.md` + `tasks.md` |
| Verify 报告 | `openspec/changes/{需求名}/verify-report.md` | OpenSpec 三维验收结果（任务完成度+覆盖率+CR）；仅 OpenSpec 已初始化时生成 |
| 执行状态          | `{feature_dir}/execution-state.md`   | 需求状态记录                                              |
| PRD/技术方案（多域） | `{app}/req/{需求名}/prd.md`, `tech-design.md` | 各 app 各存一份；PRD 同域同内容，技术方案各 app 独立 |

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

## 资产文件

详见 `assets/` 目录：`impl-plan-steps.md`、`dual-source-validation.md`、`confirmation-gate.md`、`state-templates.md`、`path-gates.md`、`recovery-rules.md`、`prd-template.md`、`prd-validation-checks.md`、`req-split-guide.md`、`tech-design-template.md`
