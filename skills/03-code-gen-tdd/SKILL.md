---
name: code-gen-tdd
version: v3.1.2
description: 生成代码（含 TDD 验证循环）。统一主入口，支持两种输入模式——**full 模式**（需求空间：PRD + 技术方案，需先完成入口3）和 **tech-only 模式**（仅技术方案，可跳过入口2/3直接触发）。按阶段可恢复执行：先输出执行契约，再按 `Phase 1 → Phase 6` 顺序推进；默认只执行当前待执行阶段，支持 `--to`、`--resume`、`--auto`。当用户说「生成代码含测试」、「完整代码生成」、「代码生成TDD」、「只有技术方案生成代码」、「tech-only」、「直接从技术方案生成代码」时触发。
user-invocable: true
---

# 生成代码（TDD 验证循环版）

> **Skill 定义「按什么标准做」**；具体执行由多个协作 Agent 完成。
>
> 本 Skill 是**入口 4**，在「生成技术方案」（入口 3）完成后触发。
>
> 本 Skill 是**唯一**的代码生成与 TDD 闭环入口。旧的 `04-tdd-test-spec`、`05-code-gen`、`06-testcode-gen`、`07-tdd-test-runner` 已收敛到本入口，不再作为独立 Skill 执行。
>
> ⚠️ **编排边界（硬约束）**：本 Skill / orchestrator 只允许做阶段编排、Agent 调度、等待、确认门展示、状态写入。禁止在 Skill / orchestrator 内直接生成 test_spec、实现代码、Review 报告、测试代码、测试报告等 Phase 正式产物。
>
> ⚠️ **Orchestrator 禁止读产出物（Ralph 多智能体原则）**：主 Orchestrator 禁止 `Read` 任何 Phase 产出物文件（tech-design.md / test_spec.md / review报告 / 测试报告等）。只允许处理元数据：`{phase_id, status, output_path, summary(≤150char)}`。需要内容校验时，由对应专职 Agent 完成后以 summary 形式上报。

---

## 路径基准（强制执行）

- `project_root` = 当前业务工程根目录（`$PWD`）；`app-knowledge-base/`、`.mrd-to-code-config.json`、`req/`、`src/` 等工程路径相对此处解析。
- `$HOME/.claude/plugins/dev-workflow` = 当前 skill 安装根目录（含 `agents/`、`skills/`、`rules/`）。
- 裸 `agents/...` 路径先按 `config.agents.agents_dir` 查找，再按 `{project_root}/.claude/agents/` 回退，最后回退到 `$HOME/.claude/plugins/dev-workflow/agents/`。
- 裸 `skills/.../assets/...` 与 `rules/test/...` 视为随 skill 仓库分发的固定资源，默认相对 `$HOME/.claude/plugins/dev-workflow` 解析。

---

## 插件可用性检查

启动任何 Phase 之前，先读取 `.mrd-to-code-config.json` 的 `plugin_availability` 字段（缺失则所有标志位默认 `unavailable`）：

| 标志位 | 影响能力 |
|--------|---------|
| `l2_gitnexus=available` | Phase 2 `java-impl-agent` 注入 `gitnexus_mode=context`（读取存量调用链上下文）；Phase 3 Code Review 阶段 `java-review-agent` 必须优先读取 `tech-design.md` 附录II（变更影响分析）；`java-review-agent` 只允许基于实际 diff 做增量 `gitnexus_get_callers` 核验，禁止重做全量 `gitnexus_impact` |
| `l3_autoresearch=available` | Phase 2 `java-impl-agent` 注入 `autoresearch_mode=fix`（强制传入，不依赖"信息不足"主观判断）；Phase 5 TDD 循环调试阶段自动追加修复分析 |

---

## PRD 与技术方案确认门

> ⚠️ **飞书文档读取约定**：读取任何飞书文档时，**必须优先使用飞书 MCP**；仅在 MCP 工具不可用时才允许降级为 `feishu-doc-sync-agent`。

### Step 0：模式检测（静默）

1. 若用户显式传入 `mode=tech-only` → 直接跳转 **Step T**
2. 否则检测 `{feature_dir}/prd.md` 是否存在：存在 → `mode=full` 继续 Step 1；不存在 → `mode=tech-only` 跳转 Step T

### Step T：tech-only 专属路径

1. 解析 `tech_local_path`（飞书 URL 优先通过飞书 MCP 读取；本地路径直接继续）
2. 推导缺省参数：`feature_dir` 未传则以 `tech_local_path` 所在目录为准；`feature_name` 未传则从文件名去扩展名
3. 初始化目录结构：`{feature_dir}/`（**仅创建需求根目录**；子目录由对应 Phase Agent 按需创建）
4. 落盘技术方案到 `{feature_dir}/tech-design.md`
5. 初始化 `execution-state.md` → 执行 `assets/exec-state-init.sh`

### Step 1：本地文件确认（仅 mode=full）

- 两者均存在 → 设置 `tech_local_path`，执行 `assets/exec-state-init.sh` 合并写入
- `tech-design.md` 缺失 → 中断，提示先完成入口 3
- `prd.md` 缺失 → 降级为 tech-only，跳转 Step T

---

## 调用协议

### 参数语义

| 参数 | 行为 |
|------|------|
| `--plan` | 只输出执行契约，不执行任何 Phase |
| `--to phaseN` | 声明本轮目标阶段 |
| `--resume` | 从 `execution-state.md` 识别下一待执行阶段并执行 |
| `--auto` | 允许连续推进，**最多 2 个 Phase** |
| 无参数 | 等价于 `--resume`，输出执行契约后等用户确认 |

### Phase 别名

`phase1` 测试规格/OpenSpec · `phase2` 实现代码 · `phase3` 代码Review · `phase4` 测试代码生成 · `phase5` 测试执行与覆盖率诊断 · `phase6` 汇总结果/可选提交

---

## 详细规则（引用 assets）

> ⚠️ **以下三个文件是完整规则来源，每次执行前按需加载：**

- **流水线全景（Phase 0→6 定义、spawn 约束、落盘脚本）**
  → `assets/phase-definitions.md`

- **门禁规则（执行契约表模板、Token 优化门禁、防跑偏硬门、硬约束清单）**
  → `assets/gate-rules.md`

- **Phase 5 诊断决策树（达标标准、修复优先级、恢复轮次上限、过程数据落盘规范）**
  → `assets/decision-trees.md`

---

## 自动增强（可选）

- `autoresearch` 在 `l3_autoresearch=available` 时**无条件注入** Phase 2 / Phase 5，不再依赖"信息不足"软判断
- 安装命令：`/plugin install autoresearch@autoresearch`（不影响主流程）

---

## 过程数据落盘（摘要）

- **写入位置**：`{feature_dir}/execution-state.md`「过程数据」下对应小节
- **写入时机**：每完成一个 Phase 后更新
- **必须落盘字段**：`mode`、`last_completed_phase`、`next_phase`、`awaiting_user_confirmation_for`、`phase_gate_status`、`phase5_dod_met`、`test_retry_count`、`coverage_retry_count`
- **硬约束**：`last_completed_phase=phase4` 时 `next_phase` 必须写 `phase5`；Phase 2 结束后必须写入 Phase 2 变更清单

> 完整字段规范与落盘脚本见 `assets/phase-definitions.md` 各 Phase 完成落盘节和 `assets/decision-trees.md` 第六节。

---

## Beads 任务追踪集成

> **无条件启用**（移除 `if installed` 条件，Phase 门禁为强制约束，不可跳过）。
> Beads 不可用时流程中止，提示用户安装：`brew install beads && bd init && bd setup claude`

### Phase 依赖声明（启动时一次性创建）

```bash
# 创建各 Phase issue
$BD_BIN create "Phase 1: 测试规格 + OpenSpec" --type task
$BD_BIN create "Phase 2: 实现代码" --type task
$BD_BIN create "Phase 3: Code Review" --type task
$BD_BIN create "Phase 4: 测试代码生成" --type task
$BD_BIN create "Phase 5: 测试执行与覆盖率" --type task

# 声明阻塞依赖（下游 blocks 上游）
$BD_BIN dep add <phase2-id> <phase1-id> --type blocks
$BD_BIN dep add <phase3-id> <phase2-id> --type blocks
$BD_BIN dep add <phase4-id> <phase3-id> --type blocks
$BD_BIN dep add <phase5-id> <phase4-id> --type blocks
```

### Phase 门禁（替代 LLM 自觉遵守）

| 时机 | Beads 操作 | 说明 |
|------|-----------|------|
| Phase N 启动前 | `$BD_BIN ready` | 查询当前 unblocked 的 Phase；若目标 Phase 不在列表中 → 停下汇报阻塞原因 |
| Phase N 完成后 | `$BD_BIN update <id> --status done` | 标记完成，自动解除下游阻塞 |
| Phase N 失败 | `$BD_BIN update <id> --status blocked` | 标记阻塞，下游 Phase 无法启动 |

### 产出元数据写入

Phase 完成后，将产出摘要写入 Beads issue notes：

```bash
$BD_BIN update <phase-id> --notes '{"file":"req/foo/test_spec.md","size":"8KB","summary":"6个测试类/12个AC/覆盖3模块"}'
```

### 降级策略

Beads 不可用时，**流程强制中止**，输出安���指引，禁止回退到 LLM 软约束模式。
