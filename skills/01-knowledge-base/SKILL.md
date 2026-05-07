---
name: knowledge-base
version: v4.0.0
description: 梳理知识库（应用知识库 + biz prd-context）。并行调度子 Agent，全部完成后交叉验证一致性。当用户说"梳理知识库"、"生成知识库"、"一键知识库"、"知识库"时触发。默认 mode=lite（8个文件），mode=nano 适用新应用冷启动（2个文件）。
user-invocable: true
---

# 梳理知识库（Skill）

> **Skill 定义「按什么标准做」**；具体执行由 `agents/` 下的子 Agent 完成。
>
> 本 Skill 是**入口 1**，对应完整研发流程的起点。

---

## 配置文件自愈（任何情况下不可跳过）

检测 `.mrd-to-code-config.json` 是否存在：
- **存在** → 读取 `plugin_availability` 字段继续
- **不存在** → 自动生成最小配置，静默继续

```json
{
  "plugin_availability": {},
  "openspec": {"enabled": true, "threshold_person_days": 5, "generate_stage": "before_code_gen", "archive_in_stage4": true},
  "test_runtime": {"enabled": true, "mode": "mock-first"}
}
```

### 插件可用性

| 标志位 | 影响能力 |
|--------|---------|
| `l3_gitnexus=available` | GitNexus 调用链分析 |
| `l4_autoresearch=available` | 知识库梳理完成后自动追加场景补强分析 |

> 如需安装或更新插件，请运行：`/dev-workflow:00-init`

---

## 协同模型

> ⚠️ **Task prompt 硬约束**：spawn 任何 agent 时，只传文件路径和小体积元数据，禁止内联知识库内容、代码文件等大文本，避免 "Prompt is too long"。

```
用户："梳理知识库"
   │
   ├─ [pre-check] 读取 mode 参数（默认 mode=lite），配置文件自愈 + 读取 plugin_availability（静默）
   │     mode=nano → 只 spawn app-knowledge-agent，产出 2 文件
   │     mode=lite → spawn app-knowledge-agent，产出 ~8 文件
   │     ⚠️ test-knowledge-agent 默认不 spawn；仅用户显式说「生成测试知识库」时才触发
   │
   ├─ [Step 0] 旧结构知识库检测（⚠️ 仅检测不删除，记录旧目录列表供 Step 2 使用）
   │     检测 {工程根}/app-knowledge-base/ 下是否存在以下旧结构目录：
   │       - api-docs/       （旧版 API 文档，已由 autoresearch 替代）
   │       - api-testcase/   （旧版接口测试用例，已由 tdd-spec 直接读代码替代）
   │       - biz-knowledge/  （旧版业务知识库，已整合进 01_业务与领域知识层.md）
   │       - test-knowledge/ （旧版测试知识库，已由 tdd-spec 按需生成替代）
   │     │
   │     ├── 【未检测到旧目录】→ 静默跳过，继续 Step 0.5
   │     │
   │     └── 【检测到旧目录】→ 记录旧目录列表到临时变量，静默继续 Step 0.5
   │           ⚠️ 不在此步骤删除，确保 Step 1 新知识库生成成功后再清理
   │
   ├─ [Step 0.5] 知识库完整性检测（静默，不询问用户，不输出任何提示）
   │     ├── KB_INDEX.md / CONTEXT.md / api-index.md / component-index.md 任一缺失
   │     │   → 调用 app-knowledge-agent（mode=lite）静默补齐，阻塞等待完成后继续
   │     ├── db-schema.md 缺失 + 工程根存在 generatorConfig.xml → 补生成 db-schema.md
   │     └── KB_FRESHNESS.md 缺失但 CONTEXT.md 已存在
   │         → python3 静默写入最小保鲜标记（update-method: auto-patch）
   │     ⚠️ 断点续传盲区：层级文件（01_*.md—06_*.md）存在不代表上述索引文件存在，两者独立检测
   │
   ├─ [Step 1] 以 Task 工具 spawn 子 Agent（按 mode 参数决定数量）
   │     └─ app-knowledge-agent   → app-knowledge-base/（代码扫描，mode=nano/lite 均执行）
   │          ⚠️ api-docs/ 和 api-testcase/ 默认不生成；按需用 autoresearch 实时查代码
   │          ⚠️ test-knowledge-agent 默认不触发；显式请求时才 spawn（mode=biz）
   │
   │     ⚠️ **Task prompt 构造模板（硬约束，违反即 "Prompt is too long"）**：
   │     每个 agent 的 Task prompt 只允许包含以下内容，禁止任何其他文本：
   │     ```
   │     project_root={工程根绝对路径}
   │     branch={分支名}
   │     mode={nano|lite|biz|api}
   │     kb_output_path={知识库输出绝对路径}
   │     feishu_url={飞书文档URL}                    # 仅 biz-knowledge-agent（可选）
   │     config_path={.mrd-to-code-config.json 绝对路径}
   │     ```
   │     禁止项：❌ 内联 CONTEXT.md 内容  ❌ 内联 api-index.md 内容
   │             ❌ 内联代码扫描结果  ❌ 内联飞书文档全文
   │
   │     ⚠️ **旧目录禁止生成（必须追加在每个 agent Task prompt 末尾）**：
   │     ```
   │     ⛔ 禁止生成以下旧结构目录（v4.0.0 已移除，写入即任务失败）：
   │     api-docs/  api-testcase/  biz-knowledge/  test-knowledge/
   │     ```
   │
   ├─ [Step 2] 严格阻塞等待子 Agent 全部返回，记录完成状态
   │     └── 确认 KB_INDEX.md + CONTEXT.md + component-index.md 已落盘
   │          任一失败 → 记录原因，继续推进（不阻塞 Step 3/4）
   │
   ├─ [Step 2.5] 旧目录清理（Step 0 检测到旧目录时执行）
   │     前置条件：Step 2 子 Agent 全部成功返回
   │     ├── 成功 → 输出告警并请求用户确认删除：
   │     │   ⚠️ 检测到旧结构知识库目录，与新三层知识库架构（v4.0.0）不兼容：
   │     │
   │     │   | 目录 | 文件数（估算）| Token 占用（估算）| 风险 |
   │     │   |------|------------|----------------|------|
   │     │   | api-docs/ | ~57 | ~20K | ❗ 会导致上下文超限 |
   │     │   | api-testcase/ | ~57 | ~40K | ❗ 会导致上下文超限 |
   │     │   | biz-knowledge/ | ~22 | ~15K | ⚠️ 影响 02 实施方案阶段 |
   │     │   | test-knowledge/ | ~42 | ~50K | ❗ 会导致上下文超限 |
   │     │
   │     │   ✅ 新结构知识库已生成成功，可以安全删除旧目录。
   │     │
   │     │   请选择处理方式（输入选项编号）：
   │     │   [1] 立即删除所有旧目录（推荐）——安全删除，不影响代码工程文件
   │     │   [2] 只删除 api-docs/ 和 api-testcase/（保留 biz/test-knowledge）
   │     │   [3] 跳过，我稍后手动处理（⚠️ 后续阶段可能上下文超限）
   │     │
   │     │   用户选 [1] → bash: rm -rf {路径}/api-docs/ api-testcase/ biz-knowledge/ test-knowledge/
   │     │                输出「✅ 旧目录已清理」，继续 Step 3
   │     │   用户选 [2] → bash: rm -rf {路径}/api-docs/ api-testcase/
   │     │                输出「✅ 已清理高风险目录」，继续 Step 3
   │     │   用户选 [3] → 输出「⚠️ 已跳过清理，后续如遇上下文超限请手动删除旧目录后重试」
   │     │                继续 Step 3（不阻塞）
   │     │
   │     └── 失败 → 跳过清理步骤，保留旧目录作为备份，输出：
   │           ⚠️ 知识库生成未完全成功，保留旧目录作为备份。请手动检查后重试。
   │
   ├─ [Step 3] autoresearch 补强（l4_autoresearch=available 时执行，否则跳过）
   │     执行 /autoresearch:reason 验证 CONTEXT.md 实体在代码中真实存在
   │     发现遗漏实体 → 追加到 CONTEXT.md（不超行数上限）
   │
   ├─ [Step 4] 一致性验证（文件不存在则跳过该项对比，不报错）
   │     ├── 读 01_业务与领域知识层.md 的核心实体
   │     ├── 读 03_核心流程与逻辑层.md 的核心流程
   │     └── 输出差异报告（无差异则标注「两库一致」）
   │
   ├─ [Step 5] 无条件写入 KB_FRESHNESS.md（不受任何 Agent 失败影响）
   │     写入字段：最近更新时间 / 更新方式 / 保鲜周期（来自 kb_freshness.stale_after_months，默认1）
   │             / 建议复查日期 / app-knowledge 状态 / biz-knowledge 状态
   │
   └─ [Step 6] 输出汇总
         应用知识库：  {工程根}/app-knowledge-base/（共 N 个文件）
         知识库保鲜标记：{工程根}/app-knowledge-base/KB_FRESHNESS.md [已更新]
         下一步：可运行「生成PRD」（入口2）
```

---

## 产出路径规范

```text
{工程根目录}/
├── app-knowledge-base/
│   ├── CONTEXT.md                              ← L0 必读入口（≤200行）[nano+lite]
│   ├── api-index.md                            ← L1 接口聚合索引（≤150行）[nano+lite]
│   ├── KB_FRESHNESS.md                         ← 知识库保鲜标记 [lite]
│   ├── KB_INDEX.md                             ← 知识库索引（≤100行）[lite]
│   ├── component-index.md                      ← 组件统计索引 [lite]
│   ├── 01_业务与领域知识层.md                  ← L1 按需读（≤300行）[lite]
│   ├── 02_架构与设计层.md                      ← L1 按需读（≤300行）[lite]
│   ├── 03_核心流程与逻辑层.md                  ← L1 按需读（≤300行）[lite]
│   ├── 04~06_*.md                              ← L2 深度按需（不在 lite 默认生成）
│   └── db-schema.md                            ← 表结构（generatorConfig.xml 存在时）
│
│   # 已移除（2026-05-06 重构）：
│   # api-docs/         → autoresearch 实时查询替代（默认不生成）
│   # api-testcase/     → tdd-test-spec 直接读代码生成（默认不生成）
│   # biz-knowledge/    → 01_业务与领域知识层.md 覆盖（显式请求才触发）
│   # test-knowledge/   → tdd-test-spec 按需生成（默认不触发）
```

---

## 三库分工

| 知识库 | 主要消费者 | 核心原则 |
|--------|-----------|---------|
| **app-knowledge-base** | tech-design、code-gen agent | 代码视角，含类名/方法名/枚举，禁止业务词汇主导 |
| **biz-knowledge/prd-context** | prd-gen agent | 纯业务语言，禁止代码术语；按需显式请求生成 |
| **test-knowledge/modules/** | tdd-test-spec agent | 默认不生成；tdd-spec 直接读 CONTEXT.md + api-index.md |

---

## 执行模式

| 模式 | 触发词 | 产出文件 | 适用场景 |
|------|-------|---------|---------|
| `mode=nano` | 「快速初始化知识库」 | CONTEXT.md + api-index.md（共 2 个）| 新应用冷启动，只需接口列表时用 |
| `mode=lite` ⭐ **默认** | 「梳理知识库」（原有触发词不变）| ~8 个文件（见产出路径规范）| 所有场景统一入口，新建+存量均适用 |

`mode=nano` 下：只 spawn app-knowledge-agent。
`mode=lite` 下：只 spawn app-knowledge-agent。
显式要求「生成业务知识库」：额外 spawn biz-knowledge-agent（mode=lite）。
显式要求「生成测试知识库」：额外 spawn test-knowledge-agent（mode=biz）。

---

## 断点续传

仅作用于三库子 Agent 的文件生成行为：已存在 → 提示确认是否覆盖，默认**跳过**；不存在 → 重新生成。

⚠️ app-knowledge-agent 内部断点续传只跳过层级文档（`01_*.md`—`06_*.md`），对 CONTEXT.md / api-index.md / component-index.md **强制生成**，不询问覆盖。

---

## Beads 任务追踪集成

> 当 `plugin_availability.beads.installed=true` 时启用，否则静默跳过。

### 任务创建

知识库生成启动时，为每个子 Agent 创建 Beads issue：

```bash
$BD_BIN create "应用知识库生成" --type task
```

### 状态更新

| 时机 | Beads 操作 |
|------|-----------|
| Agent 启动前 | `$BD_BIN update <id> --status in_progress` |
| Agent 返回成功 | `$BD_BIN update <id> --status done` |
| Agent 返回失败 | `$BD_BIN update <id> --status blocked` |

### 降级策略

Beads 不可用时，回退到 `execution-state.md` 派发清单（见 `docs/state-protocol.md#dispatch-manifest`），不影响主流程。

---

## 资产文件

- `agents/app-knowledge/app-knowledge-agent.md`
- `agents/biz-knowledge/biz-knowledge-agent.md` ← 按需显式请求时才使用
- `agents/test-knowledge/test-knowledge-agent.md` ← 按需显式请求时才使用
- `assets/templates/` — 各知识库文档模板
