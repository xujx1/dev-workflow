# 02-implementation-plan — 执行步骤详情

> 由 `SKILL.md` 按需 Read。本文件包含 MODE A/B 完整调度流程。

---

## MODE A：单域流程（is_multi_domain=false）

### Step -1: 配置文件自愈

检测 `.mrd-to-code-config.json` 是否存在：
- **存在** → 直接读取 `plugin_availability` 字段
- **不存在** → 自动生成最小配置文件

```json
{
  "plugin_availability": {
  },
  "openspec": {
    "enabled": true,
    "threshold_person_days": 5,
    "generate_stage": "before_code_gen",
    "archive_in_stage4": true
  },
  "test_runtime": {
    "enabled": true,
    "mode": "mock-first"
  }
}
```

生成完成后静默继续，不输出任何提示。

### 插件可用性检查

| 标志位 | 影响能力 |
|--------|---------|
| `l2_gitnexus=available`（`gitnexus.mcp_available=true AND knowledge_graph≠null`） | 技术方案生成后自动调用 `gitnexus_impact` 生成附录II（变更影响分析） |
| `l3_autoresearch=available` | 技术方案生成后自动追加附录III（场景扩展）+ 附录IV（多视角架构分析） |
| `beads.installed=true` | Step -1 完成后立即执行 Beads 任务初始化（见 SKILL.md Beads 章节） |

若 `beads.installed=true`，Step -1 完成后**强制执行**：

```bash
$BD_BIN create "{feature_name} PRD生成" --type task   # 记录 id 为 prd_task_id
$BD_BIN create "{feature_name} 技术方案生成" --type task  # 记录 id 为 tech_task_id
$BD_BIN dep add <tech_task_id> <prd_task_id> --type blocks
```

### Step 0: 知识库完整性检测

- app-knowledge-base/CONTEXT.md 存在 → 继续
- app-kb 不存在 → ⚠️ 阻塞提示：先运行「梳理知识库」或回复「跳过」继续

### Step 0.5: 初始化状态文件

检测 `{feature_dir}/execution-state.md` 是否存在：
- 不存在 → 创建目录 + 初始化状态文件骨架（见 `assets/state-templates.md`）
- 已存在 → 跳过

⚠️ 使用 Bash heredoc 写入，避免 Write 工具被 Hook 阻止

### Step 1: mrd-reader-agent

- 从飞书拉取 MRD 原文（或读本地澄清版）
- 识别涉及的应用/服务
- 输出：mrd_local_path, apps[], is_multi_app, is_multi_domain（bool）, domains[]

⚠️ 单应用时 domains[] 为空，is_multi_domain=false

### Step 1.5: mrd-clarify-agent

调度 `agents/mrd-clarify/mrd-clarify-agent.md`

输入参数（单域）：`mrd_local_path`, `feature_dir`, `kb_local_path`

- 若 Agent 返回 `skipped=true` → 直接进入 Step 2
- 若 Agent 返回 `skipped=false` → 澄清完成，进入 Step 2

**落盘验证**：Agent 返回后必须执行
```bash
[ -f "{feature_dir}/mrd-clarified.md" ] && echo "OK" || echo "MISSING"
```
- 返回 `OK` → 执行 checklist 勾选（见 `assets/state-templates.md` Stage 0 节），然后进入 Step 2
- 返回 `MISSING` → 中断，报错「mrd-clarified.md 未生成」

⚠️ 知识库读取时机：知识库在 Agent 内部按需读取，避免上下文过长

### Step 2: 并行 PRD + 技术方案

两个 Agent **同时启动**，互不等待，均消费 `mrd-clarified.md` + 知识库

**硬约束**：
- 禁止使用后台模式（run_in_background=true）
- 进入 Step 2 时 mrd-clarified.md 必然存在，两个 Agent **禁止再次向用户提问澄清问题**
- spawn 任何 agent 时，Task prompt 中**禁止内联任何文件内容**；只传**文件路径**和**小体积元数据**

#### 并行 A: prd-generator-agent → prd.md

⚠️ **强制调度约束（P0，不可绕过）**：
- `subagent_type` 必须为 `dev-workflow:prd-generator`，**禁止**使用 `general-purpose` 或任何其他类型
- **禁止**在 prompt 中内联 PRD 生成逻辑（"你是PRD专家..."、"请生成PRD"等角色扮演写法 = 违规）
- prompt 中**只传路径和元数据**，格式如下（复制粘贴，不得修改结构）：

```
mrd_local_path: {feature_dir}/mrd-clarified.md
kb_local_path: {kb_local_path}
feature_dir: {feature_dir}
feature_name: {feature_name}
```

- 读取应用知识库（app-kb）
- 强制消费 `mrd-clarified.md`，禁止再次向用户提问
- prd.md 落盘并自检通过后，**立即**调度 feishu-doc-sync-agent 上传 PRD：
  - 上传 `{feature_dir}/prd.md`（仅正文一~七章）
  - 写入 `prd_feishu_url` 到 `{feature_dir}/execution-state.md`
  - ⚠️ 禁止上传任何 PRD 附录
  - 上传成功后执行 checklist 勾选（见 `assets/state-templates.md` Stage 1 节）
  - 勾选完成后并行A 才算完成

#### 并行 B: tech-design-agent → tech-design.md（经典模式）/ OpenSpec artifacts（OpenSpec 模式）

**模式判断**（静默，基于 config）：
- `plugin_availability.openspec.initialized=true` → OpenSpec 模式
- 否则 → 经典模式

传入参数：`prd_local_path`, `feature_dir`, `kb_local_path`, `config`（含 `openspec_enabled`、`repo_path`、`l2_gitnexus` 状态）、`autoresearch_mode`（若 `l3_autoresearch=available` 则固定传 `fix`）

**OpenSpec 模式**：
- 调用 `/opsx:new {feature_name} --schema java-tdd`
- 调用 `/opsx:ff` 生成 proposal.md + specs/ + design.md + tasks.md + test_spec.md
- 产物写入 `{repo_path}/openspec/changes/{feature_name}/`
- 在 `{feature_dir}/` 创建 `OPENSPEC_LINK.md` 指向 openspec change 路径
- 写入 `openspec_change_path` 到 `{feature_dir}/execution-state.md`
- 飞书上传：上传 design.md；写入 `tech_feishu_url` 到 execution-state.md
- 上传成功后执行 checklist 勾选（见 `assets/state-templates.md` Stage 2 节）
- 勾选完成后并行B 才算完成

**经典模式**：
- 并行读取全部输入（强制，不得跳过）
- 生成技术方案正文（含首版研发工时预估）
- 附录I — 需求拆解（读取 `assets/req-split-guide.md`）
- Write {feature_dir}/tech-design.md（含正文 + 附录I）
- tech-design.md 落盘后，**立即**调度 feishu-doc-sync-agent 上传技术方案：
  - 上传 `{feature_dir}/tech-design.md`
  - 写入 `tech_feishu_url` 到 `{feature_dir}/execution-state.md`
  - 上传成功后执行 checklist 勾选（见 `assets/state-templates.md` Stage 2 节）
  - 勾选完成后并行B 才算完成

### 确认门

展示双文档摘要，等待确认。格式详见 `assets/confirmation-gate.md`。

### Step 3: openspec-verify-agent（OpenSpec 已初始化时触发）

**触发条件**（静默判断）：`plugin_availability.openspec.initialized=true` 且 `openspec_change_path` 不为空（execution-state.md 中已写入）。

调度 `agents/openspec/openspec-verify-agent.md`

传入参数：
- `openspec_change_path`：`{repo_path}/openspec/changes/{feature_name}/`
- `repo_path`：业务工程根目录

**verify_result 处理**：

| verify_result | 动作 |
|---------------|------|
| PASS | 流程完成，输出验收通过摘要 |
| PASS_WITH_WARNINGS | 输出警告摘要，流程完成 |
| FAIL（tasks未完成） | 输出未完成任务清单，提示补充后重新运行 |
| FAIL（BLOCKER） | 输出 BLOCKER 列表，提示修复后重新运行 03-code-gen-tdd |
| FAIL（覆盖率不足） | 输出覆盖率诊断，提示进入 03-code-gen-tdd Phase 5 补充测试 |

⚠️ openspec-verify-agent 不负责修复——仅诊断报告，由用户或后续流程决策处理。

---

## MODE B：多域流程（is_multi_domain=true）

### Step 1.5-domain: domain-routing-agent

调度 `agents/domain-routing/domain-routing-agent.md`

传入：mrd_local_path, feature_name, apps（可选，用户直传时跳过 app-router 探测）
返回：apps_with_paths[]（含 feature_abs_path）, domains[], cross_app_contracts[]

⚠️ 严格阻塞：agent 内部完成用户确认后才返回

### Step 1.5: mrd-clarify-agent（多域）

每个域各自生成领域级 mrd-clarified.md：
- 域 X 澄清版 → 写入该域所有 app 的 {feature_abs_path}/mrd-clarified.md
- mrd-original.md 全量写入所有 app（内容不裁剪）
- 落盘验证：检查所有 app 的 mrd-clarified.md 均已落盘后才进入 Step 2

输入参数（多域，额外传入）：
- `apps[]`：本域所有 app 列表（含 feature_abs_path），用于 mrd-clarified.md 域内多写
- `all_apps[]`：全部域所有 app 列表（含 feature_abs_path），用于 mrd-original.md 全量多写

### Step 2 多域: Phase 2-A + Phase 2-B

**硬约束**：同 MODE A（禁止后台模式、禁止 prompt 内联大文本）

#### Phase 2-A：生成域级 PRD（严格阻塞，所有域 PRD 落盘后才进 Phase 2-B）

⚠️ **强制调度约束（P0，不可绕过）**：
- `subagent_type` 必须为 `dev-workflow:prd-generator`，**禁止**使用 `general-purpose` 或任何其他类型
- **禁止**在 prompt 中内联 PRD 生成逻辑（角色扮演类写法 = 违规）
- prompt 中**只传路径和元数据**，格式如下（每个域一次调用）：

```
mrd_local_path: {domain_feature_dir}/mrd-clarified.md
kb_local_path: {domain_primary_kb_path}
feature_dir: {domain_primary_feature_abs_path}
feature_name: {feature_name}
domain_name: {domain_name}
apps: [{app1_feature_abs_path}, {app2_feature_abs_path}, ...]
kb_paths: [{app1_kb_path}, {app2_kb_path}, ...]
```

每个域各启动 1 个 prd-generator-agent，传入（仅路径和元数据）：
- `mrd_clarified_path`：该域 mrd-clarified.md 的本地绝对路径
- `kb_paths[]`：该域所属各 app 的知识库根路径列表
- `domain_name`：域名标识
- `apps[]`：该域下的应用列表（含 feature_abs_path），agent 用此做多写
- `feature_dir`：该域主应用的 feature_abs_path
- `feature_name`：需求名称

输出（多写）：该域所有 app 的 {feature_abs_path}/prd.md（内容相同，各 app 各存一份）

PRD 新增"涉及应用"章节（列出该域下的 apps[]）
同域多 app 共用同一飞书 URL，各自的 execution-state.md 均记录 prd_feishu_url
上传成功后执行 checklist 勾选（见 `assets/state-templates.md` Stage 1 多域节）

#### Phase 2-B：生成各 app 技术方案（所有域 PRD 落盘后才启动）

每个应用各启动 1 个 tech-design-agent，传入（仅路径和元数据）：
- `prd_local_path`：该 app 的 {feature_abs_path}/prd.md 绝对路径
- `feature_dir`：该 app 的 feature_abs_path
- `kb_local_path`：该 app 的知识库根路径
- `config`：含 l2_gitnexus 等标志位的配置对象
- `autoresearch_mode`：若 `l3_autoresearch=available`，固定传入 `fix`（不依赖主观判断，强制传入）
- 若存在 cross_app_contracts，传入 `cross_app_contract_path`：{feature_abs_path}/cross-app-interface.md

输出：{feature_abs_path}/tech-design.md
上传飞书（独立），URL 写入该 app 的 execution-state.md（tech_feishu_url）
上传成功后执行 checklist 勾选（见 `assets/state-templates.md` Stage 2 多应用节）

### 飞书 URL 有效性校验

所有 Agent 返回后、确认门之前，强制执行：
- is_multi_domain=false：从 `{feature_dir}/execution-state.md` 读取
- is_multi_domain=true：遍历所有 app 的 execution-state.md，检查每个 app 的 prd_feishu_url 和 tech_feishu_url 均非空 + 合法

校验规则：
- 非空且以 `https://your-domain.feishu.cn/` 开头 → 通过
- 为空、为 `N/A`、或不符合格式 → **阻塞**，标明是哪个 app

### 确认门（多域）

格式详见 `assets/confirmation-gate.md` 的「多域确认门输出格式」节。

---

## Task 调度硬约束（最高优先级，所有 Step 均适用）

1. **禁止后台模式**：spawn 任何 Agent 时，`run_in_background` 必须为 `false` 或省略。后台 Task 在 session 断开时丢失上下文。
2. **禁止 prompt 内联大文本**：spawn Agent 的 prompt 中只传文件路径和小体积元数据，禁止内联 MRD 原文、知识库内容、代码文件等大文本。
3. **禁止跳步**：每个 Step 完成前不得输出"已完成"并跳转下一步。

---

## 质量标准

- 所有图表使用 **Mermaid** 格式（禁止 ASCII art）
- PRD **只包含产品可读正文**（一~七章）；**禁止**包含任何附录
- **PRD 内容过滤规则**：详见 `agents/prd-generator/prd-generator-agent.md` 中的「PRD 内容过滤规则（硬约束）」章节
- 技术方案正文**必须**包含：接口变更清单/DB Schema/核心逻辑/时序图/工时预估
- **禁止**将技术细节写入 PRD 正文；**禁止**将产品语言作为技术方案的主要内容
- 当输入为 `mrd-clarified.md` 时，**禁止再次向用户提问 MRD 澄清问题**
- **首版工时预估是强制产物，不得缺失**
- **本阶段禁止生成任何代码**
