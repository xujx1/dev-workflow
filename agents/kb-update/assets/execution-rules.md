# kb-update-agent 执行规则详情

> 本文件由 `kb-update-agent.md` 骨架按需 Read。

> 通用执行规则（状态文件写入/并行派发/派发失败处理/Token 门禁）详见 `rules/common/execution-rules.md`。

## Step 4-2-A：分析本次变更范围

> 代码事实口径：以 `archive_code_ref` 对应代码为最终事实源，`ai_commit_hash` 仅用于采纳率对比。
> ⚠️ **Token 保护**：使用 `--name-only` 仅获取变更文件名，禁止使用全量 `git diff`（输出可超万行）。

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

## Step 4-2-B：并行启动三个子 Agent

**在单条消息中同时发起所有子 Agent（`run_in_background: true`），不等待任何一个完成。**

### 子 Agent 1：app-kb-update-agent

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

  ⚠️ Token 保护硬约束（违反视为执行错误）：
  - 禁止全量 Read 任何现有知识库文件
  - 确认章节结构时使用 Grep 搜索关键标题，不得全量读取
  - 追加内容时先 Read 目标文件末尾 30 行（offset=-30）确认追加位置，再 Edit
  - 单次追加内容不超过 100 行
```

### 子 Agent 2：biz-kb-update-agent

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

### 子 Agent 3：testcase-kb-update-agent

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

  ⚠️ Token 保护硬约束（违反视为执行错误）：
  - 禁止全量 Read modules/ 下任何现有知识库文件
  - 只允许用 Glob 列出文件列表 + Read 目标文件的前 80 行（offset=0, limit=80）确认结构后，使用 Edit 追加增量内容
  - 若需要确认现有章节结构，使用 Grep 搜索关键词，不得全量读取
  - 单次追加内容不超过 150 行；超出时拆分为多次 Edit 追加
```

## Step 4-2-C：等待所有子 Agent 完成

轮询三个子 Agent 状态，展示进度。某个 Agent 失败不阻塞其余 Agent。

## Step 4-2-D：完成性校验

| 校验项 | 校验逻辑 |
|--------|---------|
| C1 变更类型全覆盖 | 每个变更类型对应文档是否已更新 |
| C2 新接口同步 | 02_架构与设计层.md 是否已更新接口签名 |
| C3 test_spec 对齐 | test_spec 存在时 testcase-kb 是否同步 |

校验不通过时标注 `[待补充]`，不阻塞后续。

## Step 4-2-E：更新知识库保鲜标记

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

## Step 4-2-F：输出更新汇总格式

```
应用知识库：{N} 个文档已更新
业务知识库：[✅ 完成 / ⏭️ 已跳过]
测试知识库：[✅ 完成 / ⏭️ 已跳过]
完成性校验：C1/C2/C3 [通过 / 待补充]
```

返回 `kb_updated: true` + 更新文件列表 + `kb_freshness_path`。
