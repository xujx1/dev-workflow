# instinct-extract-agent 执行规则详情

> 本文件由 `instinct-extract-agent.md` 骨架按需 Read。

> 通用执行规则（状态文件写入/并行派发/派发失败处理/Token 门禁）详见 `rules/common/execution-rules.md`。

## Step 1：三源数据读取

| 优先级 | 数据源 | 路径 | 读取内容 |
|--------|--------|------|---------|
| P0 | 归档报告 | `{feature_dir}/archive-report.md` | 节4：AI 代码采纳率 |
| P1 | Code Review | `{feature_dir}/code-review.md` | L0 BLOCK 问题列表 |
| P2 | 执行状态 | `{feature_dir}/execution-state.md` | 各阶段结论、阻塞原因 |

若三者均不存在，直接停止，不阻塞主归档流程。

## Step 2：双向模式识别

**正向（成功模式）**：
- 采纳率 ≥ 80% 的写法 → `project-instinct` 候选
- 本次需求特有做法 → `task-instinct` 候选

**负向（失败/改进模式）**：
- 被改写 ≥ 2 次的模式 → `refine-instinct`
- Code Review L0 BLOCK → `anti-pattern` 候选
- Phase 5 测试循环 ≥ 3 轮仍失败 → `anti-pattern` 候选

## Step 3：三类本能提炼

| 类型 | 数量上限 | 触发条件 |
|------|---------|---------|
| `project-instinct` | 1~3 条 | 跨需求可复用、置信度 ≥ 0.6 |
| `task-instinct` | 1~2 条 | 本次需求特有、置信度 0.3~0.6 |
| `anti-pattern` | 1~3 条 | 有明确 L0 BLOCK 或 ≥3 轮测试失败证据 |

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

## Step 4：双轨写入

**轨道 A — instinct 文件**：
```
.claude/projects/{project_hash}/instincts/{feature_name}-{type}-{N}.md
```
每条 instinct 写入独立文件，目录不存在则创建。

**轨道 B — MEMORY.md 追加**：

追加到 `.claude/projects/{project_hash}/MEMORY.md`：

```markdown
## [{date}] {feature_name} — 本能提炼

### ✅ 成功模式（project-instinct / task-instinct）
- [{type}][{domain}] {trigger}：{action}（置信度 {confidence}）

### ⚠️ 改进模式（refine-instinct）
- [{domain}] {trigger}：被改写 {N} 次 → 建议改用 {counter.建议替代}

### ❌ 反例约束（anti-pattern）
- [{domain}] 禁止：{counter.禁止写法}
  原因：{counter.原因}（来源：{source}）
---
```

若 `MEMORY.md` 不存在则创建（写入标题头）。

**轨道 C — 需求日志（可选）**：
```
.claude/projects/{project_hash}/memory/{date}.md
```

## Step 5：输出摘要格式

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
