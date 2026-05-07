# 各 Agent 执行规则汇总

> 本文件整合所有 Agent 的 `assets/execution-rules.md`，各 Agent 骨架按需 Read 本文件并搜索对应章节。
>
> **查找方法**：在本文档搜索 Agent 名称（如 `archive-report-agent`）定位对应章节。

---

## 通用执行规则

### 1. 规则读取约定（强制）

每个 Agent 执行前，必须完整读取其执行规则：

```
执行前必须先 Read 执行规则文件，禁止凭记忆操作。
```

- 规则文件应通过骨架 `*-agent.md` 中声明的固定资源路径定位
- 若规则文件不存在，立即停止并报告，不得继续执行

### 2. 状态文件写入规则

当 Agent 涉及多步骤或断点续传时，状态写入 `{feature_dir}/execution-state.md`：

```markdown
# {feature-name} — 执行状态

## 阶段状态
| 阶段 | 状态 | 时间 |
|------|------|------|
| {stage} | PENDING / IN_PROGRESS / DONE / FAILED | {datetime} |

## 任务列表
- [x] 已完成任务
- [ ] 待完成任务

## 变量
| 变量 | 值 |
|------|---|
| feature_dir | {feature_dir} |
```

**断点续传**：若 `execution-state.md` 已存在，读取未完成任务，从中断点继续，不重新生成。

### 3. 并行子 Agent 派发规则

当需要 spawn 多个子 Agent 时，遵循 `rules/common/agents-parallel-wait.md`：

- **规则 A（严格阻塞等待）**：所有 `Task` 调用必须显式声明等待点，禁止 fire-and-forget
- **规则 B（串行降级）**：不支持并行时改为串行逐一执行
- **规则 C（完成确认）**：返回后校验关键产出文件是否已写入
- **规则 D（派发清单持久化）**：spawn >= 2 个 Agent 时写入派发清单到 `execution-state.md`

派发时在 prompt 中显式声明：

```
严格阻塞等待：必须等待本步骤中所有 Task 工具调用均返回结果后，
才能继续执行下一步骤。禁止在任何子 Agent 未完成时向用户输出内容或执行后续操作。

若模型不支持并行阻塞等待，则改为串行逐一执行：
先等 Agent 1 返回，再等 Agent 2 返回，再等 Agent 3 返回。
```

### 4. 派发失败处理

遵循 `rules/common/agents-failure-handling.md` 统一降级协议：

```
primary_dispatch → serial_retry → fail_stop
```

| 阶段 | 说明 |
|------|------|
| `primary_dispatch` | 按原始派发方式执行 |
| `serial_retry` | 退化为串行逐一真实 spawn（不允许主会话代执行） |
| `fail_stop` | 串行重试后仍失败，必须停止在当前 Phase |

**禁止行为**：不得以"子 Agent 起不来"为由跳过、降级或主会话代执行。

### 5. 输出摘要格式约定

Agent 完成后应输出结构化摘要，格式因 Agent 职责而异，但必须包含：

- 执行结果状态（成功/失败/跳过）
- 产出物路径列表
- 关键指标数据（如覆盖率、文档数、commit hash 等）

> 返回给 orchestrator 时，遵循 `rules/common/agents.md` 中「Agent 返回格式规范」，
> 只返回 `{ "status": "done", "file": "...", "size": "...", "summary": "..." }`，
> 禁止返回文件全文。

### 6. Token 优化门禁

遵循 `rules/common/agents-prohibitions.md` Phase 节奏控制：

- 知识库注入总行数 <= 350 行
- 禁止一次性 Read >= 3 个知识库文件
- 禁止连续推进 >= 3 个 Phase
- 最多连续 2 个 Phase 后停下汇报，提示 `/compact`

> Token 优化门禁检查脚本详见 `docs/state-protocol/gate-check-scripts.md`

---

## archive-report-agent 执行规则

### Step 4-3-A：确定飞书上传目标

> 飞书上传为强制步骤，不得跳过。

**迭代号三级查找链（按顺序，成功即停止）**：

```
Level 1：读 mrd-clarified.md → 查找 `> 迭代号：` 行
Level 2：查询迭代追踪表 feishu_get_doc_content(config.feishu.iteration_table_url)
         默认：https://your-domain.feishu.cn/wiki/DthEwdPPHipUF8k4iLucriYonuw
Level 3：阻塞询问用户（禁止跳过）
```

**上传目录解析（三级，按顺序，成功即停止）**：

```
Level 1：config.feishu.execution_space_url 有值 → 直接使用（项目级硬配置优先）

Level 2：从 wiki 主目录中按 iteration_no 匹配迭代子页面 URL
  - feishu_get_doc_content(config.feishu.wiki_root_url)
    缺省：https://your-domain.feishu.cn/wiki/JoYLweMjQi0haGkrxE3cYbAnnFb
  - 在返回内容中搜索包含 "{iteration_no}" 的飞书 wiki 链接（格式如 /wiki/Xxxxx）
  - 找到 → resolved_parent_url = 该完整 URL（https://your-domain.feishu.cn/wiki/Xxxxx）

Level 3：主目录中未找到 iteration_no 对应条目（迭代子页面尚未创建）
  → 自动创建：
    feishu_create_doc(
      title: "{iteration_no} 迭代",
      content: "# {iteration_no} 迭代\n\n本页自动创建，用于归档迭代需求报告。",
      parentUrl: config.feishu.wiki_root_url（缺省 https://your-domain.feishu.cn/wiki/JoYLweMjQi0haGkrxE3cYbAnnFb）
    )
  → resolved_parent_url = 新创建页面的返回 URL
  → 在输出汇总中注明：「已自动创建迭代目录：{url}」
```

### Step 4-3-B：生成需求跟踪报告

> 代码事实口径：以 `archive_code_ref` 对应代码为准；`ai_commit_hash` 仅用于采纳率对比。
> commit 基线校验：生成节 4 前必须 `git rev-parse --verify` 校验两个 hash，任一不可解析则写 `AI 代码采纳率 = —`。

并行读取：`{feature_dir}/mrd-clarified.md`、`{feature_dir}/prd.md`、`{feature_dir}/tech-design.md`、`assets/archive-report-template.md`

报告结构（5 个主体节）：
- **节 1**：MRD 标准度（背景/目标/用户/场景/验收/风险 6 维度）
- **节 2**：AI PRD 功能覆盖度（PRD Story 数 vs MRD 需求点）
- **节 3**：AI 技术方案覆盖度（技术方案 vs PRD Story 覆盖率）
- **节 4**：AI 代码采纳率（ai_commit_hash 基线 vs archive_code_ref 最终快照）
- **节 5**：测试报告摘要（spawn coverage-report-agent 获取覆盖率）

**节 4 计算**：
```bash
git diff {ai_commit_hash}^ {ai_commit_hash} --stat  # AI 初版基线
git diff {ai_commit_hash} {archive_code_ref} --stat  # 归档前追加修改
```

报告头部必须写入：
- `OpenSpec 变更：{openspec_archive_status}`
- `AI 生成 commit：{ai_commit_hash}`
- `归档代码快照：{archive_code_ref}`

禁止残留占位符（`{score}`、`{prd_coverage}` 等），违反则视为生成失败。

### Step 4-3-B.5：生成命中追踪总结（节 6）

**读取来源**：
1. `{feature_dir}/execution-state.md` 中"过程数据"小节
2. 禁止：生成或依赖 `hit-tracking-report.md`（已废弃）

**节 6 格式**：
```markdown
## 节 6：命中追踪

### 按阶段阅读轨迹
- PRD 生成：主要依赖知识资产（应用知识库/业务知识库/代码入口）
- 技术方案：主要参考（PRD/应用知识库/核心代码）
- 测试规格：主要参考（技术方案/测试知识库/业务场景）
- 代码生成/Review：主要参考（技术方案/知识库/核心链路代码）
- 测试代码：主要参考（test_spec/测试规则/调用链代码）

### 重点命中资产
- 应用知识库：3-5 个关键文档
- 业务知识库：2-4 个关键文档
- 测试知识库：2-4 个关键文档
- 关键代码：3-5 个核心类/文件

### 阶段知识库命中率
- PRD 生成：{prd_kb_hit_rate}
- 技术方案：{tech_kb_hit_rate}
- 测试用例：{test_spec_kb_hit_rate}

### 结论（2-4 句）
```

节 6 完成后才能进入 Step 4-3-C。

### Step 4-3-C：上传飞书（强制）

**前置校验（parentUrl 非空门禁）**：

```
若 resolved_parent_url 为空 / null / undefined：
  → 阻塞，输出：
    飞书上传中止：parentUrl 未解析成功。
    请检查 config.feishu.execution_space_url / wiki_root_url 配置后重试。
  → 禁止继续调用 feishu_create_doc
  → 禁止进入 Step 4-3.5
```

通过校验后方可调用：

```
feishu_create_doc(
  title: "{需求名称} 需求跟踪报告（迭代{iteration_no}）",
  content: archive-report.md 内容,
  parentUrl: {resolved_parent_url}   ← 必须为非空字符串
)
```

> 标题禁止含"草稿""草案""Draft"等表述。
> 上传前必须校验无残留占位符。
> 失败时重试一次；重试仍失败则阻塞，禁止直接进入 git commit。

### Step 4-3.5：git commit 归档产物

```bash
git add {kb_local_path}/
git add {feature_dir}/archive-report.md
git commit -m "chore: 归档 {需求名称}（迭代{iteration_no}）

- 知识库已更新：{kb_updated_files}
- 需求跟踪报告：{feature_dir}/archive-report.md
- 飞书报告：{feishu_report_url}"
```

### Step 4-4：输出归档汇总格式

```
## 归档完成

核心指标：MRD标准度/PRD覆盖度/技术方案覆盖度/代码采纳率/各阶段命中率/测试行覆盖率
产出物：OpenSpec归档状态/知识库更新情况/本地报告/飞书报告/归档commit
```

---

## biz-knowledge-agent 执行规则

### 核心原则

#### 消费者分离原则

| 文档 | 硬约束 |
|------|--------|
| B1a `business-flow.md` | **禁止**出现服务名、API、表名、类名；纯业务视角 |
| B1b `system-flow.md` | **必须**包含服务名、状态枚举、调用方式、代码入口 |
| B1c `data-flow.md` | **必须**标注每张表的数据库归属；**必须**标注跨库边界 |

#### 渐进式加载原则

- 每层先生成 `_index.md`，其他文档从索引按需链接
- 索引文件 <=80 行，子文档 <=200 行

### 步骤详情

#### 步骤 1：参数校验与初始化

- 确认业务域名称（必须项）
- 确定输出目录和域目录
- 判断可生成层（根据可用信息决定）：
  - 无：B0 关键词骨架
  - 飞书文档：B0 + B2 SOP
  - 工程代码：B1b 系统流程 + B1c 数据流
  - 飞书 + 代码：全部四层

#### 步骤 2：断点续传 / MRD 增量更新

- 扫描已生成文件，已存在则跳过
- MRD 增量模式：只重新生成 MRD 涉及子域，其他保持不动

#### 步骤 3：读取知识来源（并行）

**代码来源**：
- 读取 `CONTEXT.md`、`api-index.md`
- `grep -r "enum.*Status"` → B1b 状态机
- `grep -r "@RabbitListener\|@KafkaListener"` → B1b MQ
- `grep -r "@FeignClient"` → B1b 调用链
- 搜索 Mapper/Repository → B1c

**飞书来源**：读取飞书文档内容 → B0/B2

**子域 > 5 时启用 Sub Agent 并行处理（每 5 个一批）。**

#### 步骤 3.1：Sub Agent 并行处理

```
Sub Agent Prompt 模板：
你是业务知识库生成器。任务：为以下子域生成业务知识库
输入：业务域名、子域列表、工程名称、输出目录、飞书文档
执行步骤4至步骤8，严格遵守消费者分离原则（B1a禁止技术词汇）。
```

#### 步骤 4：P0 — 平台操作拓扑（有飞书文档时）

文件：`platforms/_index.md` + `platforms/{platform}.md`

操作入口表（6列）：`菜单路径 | 操作 | 功能CODE | API URL | 后端应用 | Controller 入口`

#### 步骤 5：B0 — 业务关键词（始终生成）

- `keywords/_index.md`（总索引）
- `keywords/{domain}-domain.md`（每词含：定义/同义词/反义词/上下文/代码映射/关系）
- `keywords/update/glossary.md`（待审新术语）

#### 步骤 6：B1 — 业务流程（三子层）

**处理顺序：B1b → B1c → B1a（代码先行，业务后抽象）**

**步骤 6.1**：生成路由表 `{sub-domain}/flow-matrix.md`（环节字典 + 场景路由矩阵）

**步骤 6.2**：生成环节原子文档 `steps/{step-name}.md`（业务定义+变体+输入输出+角色+系统实现）

**步骤 6.3**：生成场景三子层：
- **B1b** `scenarios/{name}/system-flow.md`：服务调用链+状态机+MQ+配置项+异常处理，**必须**标注代码位置 `类名:行号`
- **B1c** `scenarios/{name}/data-flow.md`：ER图+实体清单+数据流向+跨库边界，**必须**标注 datasource 归属
- **B1a** `scenarios/{name}/business-flow.md`：从 B1b 抽象，**零技术词汇**，包含角色/流程/异常/关联 SOP。生成后添加审核提示

#### 步骤 7：B2 — 实操 SOP（有飞书文档时）

文件：`{sub-domain}/sop/{sop-name}.md`，包含 SOW 部分 + 操作步骤 + 决策流程 + 检查清单 + 回滚方案

类型标注：`业务操作`（运营/客服）或 `技术操作`（开发/DBA/运维）

#### 步骤 8：生成域索引

`{domain}/_index.md`（域导航：子域列表 + 相关服务 + 关联平台入口 + 关键词链接）

#### 步骤 8.5：生成 prd-context（有 B1a 内容时必须执行）

输出：`prd-context/{NN}_{sub-domain}.md`（每子域一文件）

**内容结构**：业务定义 + 核心业务流程 + 关键业务规则 + 当前状态说明 + 异常分支 + 相关 SOP

**零技术词汇约束（强制）**：禁止类名/方法名/枚举值/`*.java:行号`/@注解/表名/API URL

#### 步骤 9：生成汇总报告

输出：各层文件数量统计 + 待人工审核清单 + 跳过文件 + 未生成原因

### 执行模式

#### `mode=full`（默认）

完整生成 P0 → B0 → B1(a/b/c) → B2 → prd-context

#### `mode=lite`（快速）

只生成 `prd-context/`：
- `prd-context/_index.md`（<=80 行）
- `prd-context/{NN}_{sub-domain}.md`（<=100 行/文件）

跳过：P0/B0/B1/B2，断点续传简化为「存在则跳过」。

---

## code-gen-agent 执行规则

### 步骤 0：飞书同步检查（强制）

检查本地是否已有 `{feature_dir}/tech-design.md`，**无论是否存在都必须展示确认门并停止等待**：

```
3-0 技术方案同步检查

当前将使用的技术方案：
- 本地文件：{feature_dir}/tech-design.md
- 飞书确认版：{存在 → 路径 | 不存在 → "未找到"}

技术方案是否已在飞书完成评审修改？
1. 提供飞书技术方案文档地址 → 拉取最新内容覆盖本地 tech-design.md
2. 回复"没有"/"跳过" → 直接使用本地文件继续
```

### 步骤 2：生成任务清单

从技术方案提取所有实现任务，写入 `{feature_dir}/execution-state.md`：

```markdown
# {feature-name} — 代码生成任务清单

> 生成时间：{datetime}
> 技术方案：{tech_local_path}

## 阶段状态
| 阶段 | 状态 | 时间 |
|------|------|------|
| impl | PENDING | - |
| review | PENDING | - |
| test-spec | PENDING | - |

## 任务列表
- [ ] {task-1}
...

## 变量
| 变量 | 值 |
|------|---|
| feature_dir | {feature_dir} |
| kb_local_path | {kb_local_path} |
| tech_local_path | {tech_local_path} |
| ai_commit_hash | (待填充) |
```

**断点续传**：若 `execution-state.md` 已存在，读取未完成任务，从中断点继续，不重新生成。

### 步骤 3：执行代码生成

**方式 A（推荐）**：spawn java-impl-agent 子代理

路径推导顺序：
1. `config.agents.agents_dir` + `/` + `config.agents.impl_agent`
2. `{project_root}/.claude/agents/java-impl-agent.md`
3. `$HOME/.claude/plugins/dev-workflow/agents/java-impl/java-impl-agent.md`

spawn 时传入：`tech_local_path`、`kb_local_path`、`feature_dir`、`plan_path`

**方式 B（降级）**：无法 spawn 时直接实现，遵守 `rules/java/code-quality.md` BLOCKER 快速扫描（B1-B10）。

> 不生成单元测试，由独立 TDD skill 支持。

### 步骤 4：git commit

```bash
git add -p   # 仅暂存本次变更相关文件
git commit -m "feat: AI生成 {change_name} [ai-generated]

Tech design: {tech_local_path}
Plan: {feature_dir}/execution-state.md
Generated at: {datetime}"
```

记录 `ai_commit_hash`（`git rev-parse HEAD`），更新 `execution-state.md`，将 `impl` 状态改为 `DONE`。

### 步骤 4.5：自动触发 java-review-agent

commit 完成后自动执行（无需用户指令），spawn review 子代理：

```
输入：review_target=git diff HEAD~1 HEAD、feature_dir、change_name、kb_local_path
产出：{feature_dir}/code-review.md、review_result
```

| review_result | 后续动作 |
|--------------|---------|
| BLOCK | 修复所有 L0 → git commit 追加修复 → 重新 review（最多 2 次）|
| WARN | 记录 review_report_path，继续步骤 5 |
| PASS | 继续步骤 5 |

### 步骤 6：自动触发 test-spec 子代理

验证通过后自动执行（无需用户指令），spawn test-spec 子代理：

```
输入：tech_local_path（优先 confirmed，降级 draft）、prd_local_path（若存在）、feature_dir、kb_local_path
输出：{feature_dir}/test_spec.md
```

### 完成汇报格式

```
## Stage 3 完成：代码已生成并提交

AI 生成版 commit：{ai_commit_hash}（分支：{branch}）
产出物：execution-state.md（全 [x]）/ code-review.md（{review_result}）/ test_spec（路径）
{若 WARN：Review 报告中有 L1 问题，请在 PR 阶段处理}
```

---

## instinct-extract-agent 执行规则

### Step 1：三源数据读取

| 优先级 | 数据源 | 路径 | 读取内容 |
|--------|--------|------|---------|
| P0 | 归档报告 | `{feature_dir}/archive-report.md` | 节4：AI 代码采纳率 |
| P1 | Code Review | `{feature_dir}/code-review.md` | L0 BLOCK 问题列表 |
| P2 | 执行状态 | `{feature_dir}/execution-state.md` | 各阶段结论、阻塞原因 |

若三者均不存在，直接停止，不阻塞主归档流程。

### Step 2：双向模式识别

**正向（成功模式）**：
- 采纳率 >= 80% 的写法 → `project-instinct` 候选
- 本次需求特有做法 → `task-instinct` 候选

**负向（失败/改进模式）**：
- 被改写 >= 2 次的模式 → `refine-instinct`
- Code Review L0 BLOCK → `anti-pattern` 候选
- Phase 5 测试循环 >= 3 轮仍失败 → `anti-pattern` 候选

### Step 3：三类本能提炼

| 类型 | 数量上限 | 触发条件 |
|------|---------|---------|
| `project-instinct` | 1~3 条 | 跨需求可复用、置信度 >= 0.6 |
| `task-instinct` | 1~2 条 | 本次需求特有、置信度 0.3~0.6 |
| `anti-pattern` | 1~3 条 | 有明确 L0 BLOCK 或 >=3 轮测试失败证据 |

每条本能格式：

```markdown
---
id: {feature_name}-{短描述}-{yyyyMMdd}
type: project-instinct | task-instinct | anti-pattern | refine-instinct
trigger: "当 {触发场景}"
confidence: {0.3~0.9}
domain: {code-style|testing|architecture|biz-pattern|db-pattern|anti-pattern}
source: {archive-observation|review-block|execution-state}
scope: project
---

# {短描述}

## Action
{1~2 句具体行为描述}

## Evidence
- 来源：{数据源名称}（P0/P1/P2）
- {具体观察：如"采纳率 90%"、"L0 BLOCK #B3"}

## Counter（仅 anti-pattern / refine-instinct 必填）
- 禁止写法：{具体代码模式}
- 建议替代：{推荐写法}
- 原因：{1 句说明}
```

### Step 4：双轨写入

**轨道 A — instinct 文件**：
```
.claude/projects/{project_hash}/instincts/{feature_name}-{type}-{N}.md
```
每条 instinct 写入独立文件，目录不存在则创建。

**轨道 B — MEMORY.md 追加**：

追加到 `.claude/projects/{project_hash}/MEMORY.md`：

```markdown
## [{date}] {feature_name} — 本能提炼

### 成功模式（project-instinct / task-instinct）
- [{type}][{domain}] {trigger}：{action}（置信度 {confidence}）

### 改进模式（refine-instinct）
- [{domain}] {trigger}：被改写 {N} 次 → 建议改用 {counter.建议替代}

### 反例约束（anti-pattern）
- [{domain}] 禁止：{counter.禁止写法}
  原因：{counter.原因}（来源：{source}）
---
```

若 `MEMORY.md` 不存在则创建（写入标题头）。

**轨道 C — 需求日志（可选）**：
```
.claude/projects/{project_hash}/memory/{date}.md
```

### Step 5：输出摘要格式

```
提取结果：
  project-instinct：{N} 条
  task-instinct：{N} 条
  anti-pattern：{N} 条
  refine-instinct：{N} 条

数据源使用：
  P0 archive-report：{可用|不可用}
  P1 code-review：{可用|不可用}
  P2 execution-state：{可用|不可用}

写入文件：
  [轨道 A] {各 instinct 文件路径}
  [轨道 B] MEMORY.md（追加 {N} 条）
```

---

## java-impl-agent 执行规则

### 实现前置检查

开始编码前确认：

- [ ] 读取相关业务模块文档，理解业务规则
- [ ] grep 搜索现有类似实现，避免重复造轮子
- [ ] 确认修改落在哪一层（interfaces / application / domain / infrastructure）
- [ ] 确认异常处理规范（`04_工程与规范层.md`）
- [ ] 若涉及 DB 改动，确认字段命名规范（表名单数、必备三字段、禁止保留字）
- [ ] 若涉及 Redis，确认 Key 格式（`业务名:模块名:唯一标识`，必须设 TTL）
- [ ] 若涉及 MQ，确认消费幂等方案

### DDD 分层约定

```
{service}-interfaces/       ← Controller、Dubbo/gRPC 实现
{service}-application/      ← Application Service、Handler、Unit
{service}-domain/           ← 领域对象、领域服务、领域事件
{service}-infrastructure/   ← Mapper、外部 Client、MQ Producer
```

**分层职责硬约束**：
```
Controller   → 参数校验、协议转换，禁止写业务逻辑
Service      → 业务逻辑编排，@Transactional 所在层
Manager      → 通用能力下沉（缓存、三方封装、多 DAO 组合）
DAO/Mapper   → 只做数据读写，禁止包含业务判断
```

### 通用强卡规则（编码时实时强制）

#### 命名
- 类名 UpperCamelCase（DO/BO/DTO/VO/AO 除外）
- 方法/变量 lowerCamelCase，常量 UPPER_SNAKE_CASE
- POJO 类布尔字段不加 `is` 前缀

#### 并发 / 线程
- 禁止手动 `new Thread()`，使用项目统一线程池管理器
- 禁止 `Executors.newXxx()`，使用 `ThreadPoolExecutor` 显式创建
- `@Async` 必须指定线程池名称

#### SQL / ORM
- 禁止 `SELECT *`，必须指定字段
- 禁止 `${}` 拼接（使用 `#{}`）
- 更新操作必须同步更新 `gmt_modified`
- 禁止 JOIN 超过 3 张表

#### Spring Boot 分层
- `@Transactional` 只加在 Service 层 public 方法
- 事务内禁止 RPC/HTTP 远程调用
- 接口统一返回 `Result<T>`，入参 >2 字段封装 DTO

#### Redis
- 所有 Key 必须设置 TTL
- 分布式锁必须使用 Redisson RLock，`finally` 中释放

#### MQ
- 消费者必须实现幂等（DB 状态判断 or Redis SET NX msgId）
- DB 写入 + 发消息必须使用事务消息或本地消息表

#### 代码结构
- 单方法 <= 200 行，for 循环嵌套 <= 3 层，`catch` 块不能为空

### 产物约束（硬约束，不可绕过）

- **禁止**生成 `code-changes.md`、`change-plan.md`、`impl-summary.md` 等变更描述文件
- **必须**直接修改对应的 `.java` 源文件
- 实现完成后只产出：已修改的 `.java` 源文件 + 编译结果 + BLOCKER 扫描报告

### Review 回流约定

当 `task=fix-review-blockers` 时：
- 必须读取本轮 `blocker_report`
- **L0 问题必须全部修复**
- 同文件、低风险、低成本的 L1 问题默认同批修复
- 高风险 L1 可保留，但需在摘要中说明原因
- 本 Agent 不重新执行完整 Review，只做修复 + 编译 + BLOCKER 快速扫描

### 实现流程

1. 读 `_index.md` → 路由到相关 L1 文档
2. 读业务模块文档，理解业务规则和代码入口
3. grep 搜索相似实现（参考命名风格）
4. 编码，实时遵守强卡规则
5. 首轮实现完成后交给 `java-review-agent`（不在首轮强制跑 `mvn compile`）
6. 回流修复时优先 L0，尽量同批吸收低风险 L1
7. Phase 3 聚合 Review 非 BLOCK 后，统一执行一次 `mvn compile` 收口

### 计时规范

遵循 `rules/common/timing-spec.md`。

| 步骤编号 | 步骤名称 |
|---------|---------|
| S1 | 上下文加载（_index.md 路由 + L1 文档） |
| S2 | 业务模块读取与相似实现搜索 |
| S3 | 编码实现 |
| S4 | BLOCKER 快速扫描（回流时）/ 编译收口（Phase 3 后） |

报表子章节：`### /03-code-gen-tdd 耗时报表` 下 `#### P2 java-impl-agent`，**必须出现在返回文本末尾**。

### 项目定制区（在项目副本中填写）

```
项目名称：{PROJECT_NAME}
Maven 模块：{MAVEN_MODULES}
规范文档路径：app-knowledge-base/04_工程与规范层.md
特有约束：
  - {例：禁止使用 @Scheduled，所有定时任务通过 XXXJob 统一管理}
  - {例：所有 Redis Key 前缀必须为 {app_name}:{service_name}:}
高频场景快捷路径：
  - 新增 MQ 消费者：参考 {existing_consumer_class}
  - 新增 HTTP 接口：参考 {existing_controller_class}
```

---

## kb-update-agent 执行规则

### Step 4-2-A：分析本次变更范围

> 代码事实口径：以 `archive_code_ref` 对应代码为最终事实源，`ai_commit_hash` 仅用于采纳率对比。
> **Token 保护**：使用 `--name-only` 仅获取变更文件名，禁止使用全量 `git diff`（输出可超万行）。

```bash
git diff {ai_commit_hash}^ {archive_code_ref} --name-only | head -100
```

结合 PRD + 技术方案，生成变更摘要：

| 变更类型 | 判断依据 |
|---------|---------|
| 核心业务逻辑变更 | Service 层有新增/修改方法 |
| 架构决策/方案选型 | 新增中间件、框架、设计模式 |
| 新增/修改接口签名 | Controller 或 Dubbo interface 有变更 |
| 接口调用链路变更 | 多 Service 协作链路有变更 |
| 配置项变更 | `application.yml` 等配置文件有变更 |
| 监控/告警变更 | 新增 metrics / alert 规则 |

若最终代码与技术方案不一致，以最终代码为准，并在知识库中补充"最终实现差异"摘要。

### Step 4-2-B：并行启动三个子 Agent

**在单条消息中同时发起所有子 Agent（`run_in_background: true`），不等待任何一个完成。**

#### 子 Agent 1：app-kb-update-agent

```
subagent_type: general-purpose
run_in_background: true
model: sonnet

prompt: |
  你是应用知识库增量更新器。
  输入：kb_local_path、变更摘要、变更文件列表、archive_code_ref

  根据变更类型更新文档（只更新涉及文档，禁止全量重写）：
  | 变更类型 | 必须更新的文档 |
  |---------|-------------|
  | 核心业务逻辑变更 | {kb_local_path}/03_核心流程与逻辑层.md（摘要式增量） |
  | 架构决策/方案选型 | {kb_local_path}/05_演进与决策记录层.md（追加 ADR）|
  | 新增/修改接口签名 | {kb_local_path}/02_架构与设计层.md |
  | 配置项变更 | {kb_local_path}/04_工程与规范层.md |
  | 监控/告警变更 | {kb_local_path}/04_工程与规范层.md（运维配置章节）|

  约束：
  - 以 archive_code_ref 对应代码为事实基线
  - 更新 03_ 时只允许追加摘要级别内容，禁止大段代码
  - 禁止在知识库末尾追加"归档更新记录"章节

  Token 保护硬约束（违反视为执行错误）：
  - 禁止全量 Read 任何现有知识库文件
  - 确认章节结构时使用 Grep 搜索关键标题，不得全量读取
  - 追加内容时先 Read 目标文件末尾 30 行（offset=-30）确认追加位置，再 Edit
  - 单次追加内容不超过 100 行
```

#### 子 Agent 2：biz-kb-update-agent

> 前置检查：`{kb_local_path}/biz-knowledge/` 不存在时跳过，报告标注 `[已跳过 - 知识库未创建]`。

```
subagent_type: general-purpose
run_in_background: true
model: sonnet

prompt: |
  你是业务知识库增量更新器。
  前置检查：{kb_local_path}/biz-knowledge/ 不存在则跳过并报告。

  根据变更类型追加更新：
  | 变更类型 | 更新内容 |
  |---------|---------|
  | 新增业务规则 | 追加到 biz-knowledge/rules/{领域}.md |
  | 修改业务流程 | 更新 biz-knowledge/flows/{流程名}.md |
  | 新增领域概念 | 追加到 biz-knowledge/glossary.md |

  约束：核对 archive_code_ref 确认规则已落地为代码真实行为。
```

#### 子 Agent 3：testcase-kb-update-agent

> 前置检查：`{kb_local_path}/test-knowledge/` 不存在时跳过，报告标注 `[已跳过 - 知识库未创建]`。

```
subagent_type: general-purpose
run_in_background: true
model: sonnet

prompt: |
  你是测试用例知识库增量更新器。
  前置检查：{kb_local_path}/test-knowledge/ 不存在则跳过并报告。

  根据变更类型更新 modules/ 下对应文档；
  若 test_spec 存在，将新增测试场景摘要合并到对应知识库文档。
  约束：最终知识库必须核对 archive_code_ref 对应实现，避免场景脱节。

  Token 保护硬约束（违反视为执行错误）：
  - 禁止全量 Read modules/ 下任何现有知识库文件
  - 只允许用 Glob 列出文件列表 + Read 目标文件的前 80 行（offset=0, limit=80）确认结构后，使用 Edit 追加增量内容
  - 若需要确认现有章节结构，使用 Grep 搜索关键词，不得全量读取
  - 单次追加内容不超过 150 行；超出时拆分为多次 Edit 追加
```

### Step 4-2-C：等待所有子 Agent 完成

轮询三个子 Agent 状态，展示进度。某个 Agent 失败不阻塞其余 Agent。

### Step 4-2-D：完成性校验

| 校验项 | 校验逻辑 |
|--------|---------|
| C1 变更类型全覆盖 | 每个变更类型对应文档是否已更新 |
| C2 新接口同步 | 02_架构与设计层.md 是否已更新接口签名 |
| C3 test_spec 对齐 | test_spec 存在时 testcase-kb 是否同步 |

校验不通过时标注 `[待补充]`，不阻塞后续。

### Step 4-2-E：更新知识库保鲜标记

至少 1 个文档成功更新时，写入：

```markdown
# 知识库保鲜标记
- 最近更新时间：{YYYY-MM-DD}
- 更新方式：incremental
- 保鲜周期：{stale_after_months}个月（默认 1）
- 建议复查日期：{YYYY-MM-DD + stale_after_months月}
- 更新来源：kb-update-agent
```

文件路径：`{kb_local_path}/KB_FRESHNESS.md`
全部失败/跳过时不得刷新该标记。

### Step 4-2-F：输出更新汇总格式

```
应用知识库：{N} 个文档已更新
业务知识库：[完成 / 已跳过]
测试知识库：[完成 / 已跳过]
完成性校验：C1/C2/C3 [通过 / 待补充]
```

返回 `kb_updated: true` + 更新文件列表 + `kb_freshness_path`。

---

## prd-generator-agent 执行规则

### Step 1：并行读取双知识库（必须执行）

> 双知识库并行读取是强依赖，不得跳过。

同时执行（不得串行）：

**A. 需求源**：`Read {mrd_local_path}`

**B. 应用知识库（事实基准）**：
- `Read {kb_local_path}/CONTEXT.md`
- `Read {kb_local_path}/02_架构与设计层.md`
- `Read {kb_local_path}/03_核心流程与逻辑层.md`
- `Read {kb_local_path}/db-schema.md`（若存在）

**C. 模板**：`Read agents/prd-generator/assets/prd-template.md`

所有 Read 操作全部返回后，才能进入 Step 2。

### Step 2：确认输入为澄清版 MRD

- `mrd_local_path` 必须指向 `mrd-clarified.md`
- 若传入原始 MRD 路径，停止执行
- 直接基于 `mrd-clarified.md` 生成 PRD，残余歧义记录到 PRD 七章

### Step 3：生成 PRD 草稿

**文档结构**（只含七章正文，无任何附录）：
```
# {需求名称} — 产品需求文档
## 一、背景
## 二、目标
## 三、角色 / 场景
## 四、功能变更
## 五、业务规则
## 六、验收标准（AC）
## 七、边界 / 待确认
```

**内容约束**：
- 产品正文使用业务语言，不出现接口签名、SQL、代码块、字段枚举值
- 流程图使用 Mermaid（`flowchart TD`/`sequenceDiagram`/`stateDiagram-v2`）
- 禁止 ASCII art，禁止 PlantUML
- **硬约束：禁止生成任何附录**
- **硬约束：禁止生成技术内容**（接口路径、DB Schema、枚举代码）
- **禁止生成需求拆解**（Story + 开发任务由技术方案附录I承载）
- 禁止在 prd.md 中留存任何 `[需确认]` 标注

**PRD 禁止包含的技术细节**：

| 禁止类型 | 应替换为 |
|---------|---------|
| HTTP 接口路径 `/electronicSheet/query` | 功能模块名，如"仓发面单查询" |
| RPC/Dubbo 签名 | "品牌直发面单服务" |
| 代码字段名 `qrCode` | "二维码" |
| 配置 Key `des.sf.qrcode.xxx` | "灰度开关（默认关闭）" |
| 类名/方法名 `ElectronicSheetService` | 删除，技术细节留给技术方案 |
| DB 表名/列名 | 删除，技术细节留给技术方案 |

**写入方式**：
- 优先：Write 工具分章节写入（先写标题骨架，再逐章节 Edit 填充）
- 备选（Write 被 Hook 阻止时）：Bash heredoc 写入

### Step 4：自检

- 所有章节（一~七）已填充（无空章节）
- 无 ASCII 图表
- **不存在任何附录章节**（违反则删除后重新自检）
- `prd.md` 中不含任何 `[需确认]` 标注
- **无任何代码块**（无 backtick 块标记；违反则将代码块替换为产品语言描述后重新自检）
- **无技术章节**（文档章节只允许「一、背景」「二、目标」「三、角色/场景」「四、功能变更」「五、业务规则」「六、验收标准」「七、边界/待确认」；如出现「接口设计」「业务逻辑」「非功能需求」等技术章节，删除后重新自检）
- **无技术符号**：不得出现类名（XxxServiceImpl）、包路径（com.xxx）、方法签名（xxx#yyy）、枚举值（XXX(15)）；违反则替换为业务语言后重新自检

---

## tdd-test-runner-agent 执行规则

### 2.0 多模块并行执行策略（必须）

当测试文件清单中的测试类分布在**多个 Maven 模块**时，**必须启用并行执行**。

**步骤 1：按模块分组**
- 解析 `test_file_list` 中每个测试类的 Maven 模块归属
- 形成 `{module} → [test classes]` 映射

**步骤 2：并行执行 `mvn test`**
```bash
mvn test -Dtest=TestA,TestB -pl module1 -DfailIfNoTests=false &
PID1=$!
mvn test -Dtest=TestC,TestD -pl module2 -DfailIfNoTests=false &
PID2=$!
wait $PID1 $PID2
```

**步骤 3：执行 `jacoco:report`**

> 首选命令（直接用，不做变体探索）：

```bash
cd {project_root}/{module_path} && {mvn_path} org.jacoco:jacoco-maven-plugin:0.8.12:report 2>&1 | grep -E "BUILD|Loading|Analyzed|report|ERROR|jacoco" | head -20
```

- `{mvn_path}` 取 `env.maven_path`（来自 `.mrd-to-code-config.json`），未读取时用 `mvn`
- `cd` 进子模块目录直接执行，**不使用 `-pl`、`-f`、`--no-transfer-progress`**
- 多模块时每个模块单独 `cd` 执行，可并行：

```bash
(cd {project_root}/module1 && {mvn_path} org.jacoco:jacoco-maven-plugin:0.8.12:report -q) &
(cd {project_root}/module2 && {mvn_path} org.jacoco:jacoco-maven-plugin:0.8.12:report -q) &
wait
```

**命令失败时的唯一兜底**（执行一次，不再尝试其他变体）：

```bash
cd {project_root}/{module_path} && {mvn_path} jacoco:report 2>&1 | tail -20
```

> 禁止探索以下变体：`mvn jacoco:report -pl ...`、`mvn jacoco:report -f ...`、`mvn jacoco:report --no-transfer-progress`、`mvn org.jacoco:... -pl ...`。变体探索 = 执行错误，直接归类 `runner_asset_failure`。

**步骤 4：合并覆盖率**
- `jacoco_incremental_coverage.sh` 指定多个 `--exec-file` 参数
- 最终报告中分模块记录各自覆盖率及总覆盖率

**约束**：
- 并行模块数上限：`min(CPU 核心数 - 1, 模块总数)`，默认最多并行 2 个模块
- 若只有单个模块有测试类，退化为串行执行
- 各模块完成后等 `wait` 全部完成，再进入增量覆盖率阶段
- 某模块失败仍需等待其余模块完成后统一汇总

### 2.0.5 多模块依赖编译兜底

若出现 `找不到符号` / `cannot find symbol`，但符号在源文件中实际存在：

**处理步骤**：
1. 识别依赖模块（从错误信息中提取包名/类名，比对 `pom.xml` 中的 `<module>` 列表）
2. 先编译依赖模块主代码（**不带 `-am`**）：
   ```bash
   mvn compile -pl {dependency_module} -q
   ```
3. 再用 `-Dmaven.compiler.includes` 精确编译目标模块的本轮测试类（**不带 `-am`**）：
   ```bash
   mvn test-compile -pl {target_module} \
     -Dmaven.compiler.includes="**/{本轮测试类}.java" -q
   ```
4. 仍失败 → **归类为 `compile_failure`，立即停止**；禁止升级为全量重编译

> 严禁：
> - `mvn -am`（带 `-am` 会编译所有上游模块及其全量测试类）
> - `mvn clean install -DskipTests`（全量重编译，耗时且触发历史遗留错误）

**禁止**因"找不到符号"立即假设符号不存在并修改源码。

### 2.1 Surefire / JUnit 4 兼容兜底

若首轮 `mvn test` 命中：`maven-surefire-plugin:2.20` + JUnit 4 + `Tests run: 0`：
- 优先判定为 Runner 工具链兼容问题
- 必须按**原清单、原测试范围**重跑，仅覆盖 Surefire 版本：`-Dmaven-surefire-plugin.version=3.2.5`
- **禁止**修改 pom.xml、父 POM 或任何业务/测试源码
- 仍无法进入有效执行 → 归类为 `runner_asset_failure`，立即停止

### 2.1.5 沙箱 / 本地 Maven 仓库兜底

若首轮 `mvn test` 因沙箱限制无法写入 `~/.m2/repository` 失败：
- 优先判定为执行环境权限问题
- 以**完整权限**重跑一次，保持原清单、原测试范围、原 Maven 参数不变
- **禁止**缩小测试范围、修改 pom.xml、修改源码
- 仍失败 → 归类为 `runner_asset_failure`

### 2.2 `testFailureIgnore` 归类口径

- `mvn test` 退出码**不是**成败唯一依据
- 必须同时检查：`mvn test` 控制台摘要 + `target/surefire-reports` + 是否存在 FAIL / ERROR
- 只要测试已进入有效执行且存在 FAIL / ERROR，最终必须归类为 `test_failure`（即使 `mvn` 返回 `exit 0`）
- 禁止把 `testFailureIgnore=true` 造成的 `exit 0` 误判成 `success`

### 增量覆盖率脚本执行顺序

1. 先按默认缓存模式执行
2. 若出现 `NoClassDefFoundError`、参数契约不匹配、缓存 classpath 失效等工具链故障：
   - 清理脚本缓存目录
   - 用 `--no-cache --exec-file ...` **仅重试一次**
3. 仍失败 → 立即归类为 `runner_asset_failure`，停止探索式试错

### 2.5 运行模式约束

**mock-first**：
- 只执行普通单测 / slice tests
- 不得因为未启动本地服务、容器、真实数据库而返回 `environment_blocked`
- 若出现 `Failed to load ApplicationContext`（根因为 Nacos 连接失败），**仍按 `test_failure` 处理**


### 覆盖率产物落盘约束

- 持久化到需求目录的正式产物只有 `{feature_dir}/unit_test_report.md`
- Maven/JaCoCo 构建产物可保留在 `target/` 下
- 若需诊断补充 XML/HTML，必须写入 `/tmp` 或 Runner 缓存目录
- **禁止**把补充产物写入 `req/.../test/_jacoco_feature/` 等需求目录

---

## tech-design-agent 执行规则

### 步骤 1：并行读取资料

同时执行（并行）：
- `Read {prd_local_path}` — PRD 确认版
- `Read {feature_dir}/mrd-clarified.md` — MRD 澄清版（强制读取）
- `Read {kb_local_path}/CONTEXT.md`（强制）
- `Read {kb_local_path}/02_架构与设计层.md`
- `Read {kb_local_path}/03_核心流程与逻辑层.md`
- `Read {kb_local_path}/db-schema.md`（若存在）
- 探索项目涉改模块代码（按需）

**GitNexus 调用链（若 `l3_gitnexus=available`）**：

```
1. gitnexus_search({涉改核心模块关键词}) → 定位涉改核心类/接口
2. gitnexus_get_callers({核心接口/方法}) → 了解上游依赖
3. gitnexus_impact({涉改核心类名}) → 获取影响评级
```

查询结果写入：模块边界 → 「三、详细设计/模块影响」；高风险链 → 「五、稳定性与风险」；上游调用方 → 「六、灰度与发布建议」。

**autoresearch 深度调研（若涉及新技术栈或复杂架构决策）**：

```
Skill autoresearch "{调研主题}" → 返回结构化调研报告
```

### 步骤 2：生成技术方案

遵循 `docs/tech-design-template.md` 结构。

**必须补齐的估算附录**：
- 改动接口数、改动表数、新增/修改类数、涉及外部系统、估算人日、人工确认状态：待确认
- `估算人日` 是 TDD 测试模式选择的输入，必须给出首版值，不得留空

**图表格式强制要求**：

| 图示类型 | 格式 |
|---------|------|
| 业务流程图 | `flowchart TD` |
| 系统时序图 | `sequenceDiagram` |
| 状态机图 | `stateDiagram-v2` |
| 依赖关系图 | `flowchart LR` |

### 步骤 3：分章节写入

```
1. Write {feature_dir}/tech-design.md ← 仅章节标题
2. Edit 逐章节填充正文
```

`tech-design.md` 写入后永不覆盖（用户修改意见以追加章节方式进行）。

### 步骤 4：生成附录I — 需求拆解

读取 `assets/req-split-guide.md`（若存在），追加到 `tech-design.md` 末尾：

```markdown
## 附录I：需求拆解
### Story 列表
| Story ID | Story 标题 | 描述 | 工时（人日）|
### 开发任务分解
| 任务 ID | 所属 Story | 任务描述 | 负责模块 | 依赖任务 |
### 依赖关系 & 风险
### 待确认项
```

### 步骤 5：生成附录II — GitNexus 影响面分析

**分支A：`l3_gitnexus=available`**：
1. 从 tech-design.md 提取涉改接口/类/方法
2. 调用 `gitnexus_impact(class_or_method)`（降级顺序：MCP → CLI → 人工摘要）
3. 附录II 标题反映实际使用方式

**分支B：`l3_gitnexus=missing`**：
```markdown
## 附录II：变更影响分析（未执行，GitNexus 未安装）
> GitNexus 插件未安装，无法自动分析调用链影响面。
> 建议安装后重新生成：`claude mcp add gitnexus -- npx -y gitnexus@latest mcp`
```

### 步骤 6：生成附录III/IV

> 附录III 和附录IV 是 tech-design.md 的必要组成部分，不得跳过，无条件执行。

**附录III — 场景扩展（技术视角）**：
- 基于附录I Story + AC，生成不少于 5 个技术边界场景
- 聚焦：并发/幂等/事务回滚/MQ 消费重复/超时/部分失败等

**附录IV — 多视角架构分析**：
- 技术风险预判（性能/并发/兼容性维度）
- 架构方案对比：至少 2 种方案 + 收敛结论

### 步骤 7：验证检查

检查 tech-design.md 是否包含附录II/III/IV，不存在则立即补写，通过后输出确认门。

---

## test-knowledge-agent 执行规则

### Mode: biz — 业务模块测试知识库

#### Step 1：参数校验
- 工程根目录 + 分支 必须提供
- 检查是否有飞书文档链接，决定执行模式（飞书驱动 / 代码驱动）

#### Step 2（飞书驱动模式）：获取飞书文档（强卡条件）
```
调用 mcp__front_feishu__feishu_get_doc_content 获取飞书文档
失败 → 立即停止，提示用户三种选项：
  ① 提供正确链接 ② 粘贴文档内容 ③ 切换代码驱动模式
```

#### Step 3：分析代码结构
- 扫描 Controller、Dubbo Service、MQ Consumer、Entity/DO、Enum
- 飞书驱动：按文档业务模块在代码中定位实现
- 代码驱动：按包结构自动识别业务域

#### Step 4：读取应用知识库（可选）
- 若 `app-knowledge-base/CONTEXT.md` 存在，读取补充背景（<=200 行）

#### Step 5：生成业务模块测试知识库

每个模块输出 `{模块名}-测试知识库.md`，包含 11 章节：
1. 业务背景与名词解释
2. 业务流程（链路梳理 + 详细流程）
3. 接口清单（Dubbo + HTTP）
4. 数据模型（入参/出参/DB表/状态枚举）
5. 消息队列（Topic/Tag/生产者/消费者/触发时机）
6. 业务测试场景层（Happy Path / Error Path / Edge Case）
7. 核心流程验证层（状态机 / 时序交互）
8. 测试工程与规范层（覆盖率要求 / 代码规范）
9. 质量保障与运维层
10. 资损风险点
11. 测试实施清单

**lite 模式**（5 章，<=80 行/文件）：业务背景 + 主要场景 + 核心流程节点 + 质量保障要点 + 资损风险

#### Step 6：生成索引文件
输出 `app-knowledge-base/test-knowledge/modules/README.md`

---

### Mode: api — 接口测试用例知识库

> **一接口一文档**：每个接口文档生成一个独立 `_testcase.md`，禁止合并。

#### Step 1：断点续传
- 扫描 `app-knowledge-base/test-knowledge/api-testcase/` 已有 `*_testcase.md`
- 已存在的接口跳过（除非明确要求重新生成）

#### Step 2：读取接口索引
- 优先读取 `app-knowledge-base/api-index.md`
- 统计接口数量，决定处理策略

#### Step 3：批量策略
- **<= 10 个接口**：顺序处理
- **> 10 个接口**：每批 10 个，并行启动 Sub Agent

Sub Agent Prompt 核心要素：
1. 工程名称 + 分支
2. 本批次接口列表
3. api-docs 目录路径
4. 输出目录（`app-knowledge-base/test-knowledge/api-testcase/`，强制）
5. 一接口一文档原则（强制重申）

#### Step 4：逐接口代码分析
- 定位 Controller（按路径搜索 `@RequestMapping` 等注解）
- 追踪 Service → Mapper 层
- 分析：参数处理、业务分支、外部依赖、配置项、幂等控制

#### Step 5：生成接口测试用例知识库（每接口一文档）

文件名：`{编号}_{接口标识}_testcase.md`，包含 10 模块：
1. 接口概述（类型/QPS/RT/说明/调用方）
2. 请求参数（字段/DTO/校验规则）
3. 业务逻辑流程（ASCII 调用链）
4. 测试用例设计（仅列实际存在的场景，禁止编造）
5. 测试数据准备（正常/错误示例/DB 要求）
6. 验证点汇总（响应/DB写/MQ/日志）
7. 关键代码路径（file:line）
8. 配置项说明
9. 注意事项
10. 测试用例统计

---

### Mode: all — 并行执行 biz + api

```
并行启动：
  ├─ [Task] test-knowledge-agent mode=biz
  └─ [Task] test-knowledge-agent mode=api

等待两者完成后，输出汇总：
  biz 知识库：{N} 个业务模块文档
  api 知识库：{N} 个接口文档
```

---

### 错误处理

| 情况 | 处理方式 |
|------|----------|
| 飞书文档获取失败 | 立即阻断，提示三种处理选项 |
| api-index.md 不存在 | 提示先运行 app-knowledge-agent |
| 工程目录不存在 | 停止报错退出 |
| 接口代码无法定位 | 跳过并记录，继续处理其他接口 |

### 输出摘要格式

```
测试知识库生成完成

业务模块知识库（biz）：
  路径：app-knowledge-base/test-knowledge/modules/
  文档：{N} 个模块

接口测试用例知识库（api）：
  路径：app-knowledge-base/test-knowledge/api-testcase/
  文档：{N} 个接口

下一步：生成 test_spec（入口4）
  需要：tech-design 路径 + feature_dir
```
