# code-gen-agent 执行规则详情

> 本文件由 `code-gen-agent.md` 骨架按需 Read。

> 通用执行规则（状态文件写入/并行派发/派发失败处理/Token 门禁）详见 `rules/common/execution-rules.md`。

## 步骤 0：飞书同步检查（强制）

检查本地是否已有 `{feature_dir}/tech-design.md`，**无论是否存在都必须展示确认门并停止等待**：

```
⚠️ 3-0 技术方案同步检查

当前将使用的技术方案：
- 本地文件：{feature_dir}/tech-design.md
- 飞书确认版：{存在 → 路径 | 不存在 → "未找到"}

技术方案是否已在飞书完成评审修改？
1. 提供飞书技术方案文档地址 → 拉取最新内容覆盖本地 tech-design.md
2. 回复"没有"/"跳过" → 直接使用本地文件继续
```

## 步骤 2：生成任务清单

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

## 步骤 3：执行代码生成

**方式 A（推荐）**：spawn java-impl-agent 子代理

路径推导顺序：
1. `config.agents.agents_dir` + `/` + `config.agents.impl_agent`
2. `{project_root}/.claude/agents/java-impl-agent.md`
3. `$HOME/.claude/plugins/dev-workflow/agents/java-impl/java-impl-agent.md`

spawn 时传入：`tech_local_path`、`kb_local_path`、`feature_dir`、`plan_path`

**方式 B（降级）**：无法 spawn 时直接实现，遵守 `rules/java/code-quality.md` BLOCKER 快速扫描（B1-B10）。

> 不生成单元测试，由独立 TDD skill 支持。

## 步骤 4：git commit

```bash
git add -p   # 仅暂存本次变更相关文件
git commit -m "feat: AI生成 {change_name} [ai-generated]

Tech design: {tech_local_path}
Plan: {feature_dir}/execution-state.md
Generated at: {datetime}"
```

记录 `ai_commit_hash`（`git rev-parse HEAD`），更新 `execution-state.md`，将 `impl` 状态改为 `DONE`。

## 步骤 4.5：自动触发 java-review-agent

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

## 步骤 6：自动触发 test-spec 子代理

验证通过后自动执行（无需用户指令），spawn test-spec 子代理：

```
输入：tech_local_path（优先 confirmed，降级 draft）、prd_local_path（若存在）、feature_dir、kb_local_path
输出：{feature_dir}/test_spec.md
```

## 完成汇报格式

```
## Stage 3 完成：代码已生成并提交

AI 生成版 commit：{ai_commit_hash}（分支：{branch}）
产出物：execution-state.md（全 [x]）/ code-review.md（{review_result}）/ test_spec（路径）
{若 WARN：Review 报告中有 L1 问题，请在 PR 阶段处理}
```
