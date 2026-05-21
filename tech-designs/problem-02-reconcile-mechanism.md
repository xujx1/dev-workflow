# 技术方案：execution-state / Beads / 产物三源 Reconcile 机制

## 背景

实践中三个事实源（`execution-state.md`、Beads 任务状态、本地文件产物）可能出现不一致，例如：

- `execution-state` 标记阶段完成，但关键产物缺失。
- Beads 标记 done，但本地文件未生成。
- 文件存在，但 `execution-state` 未推进。

当前 dev-workflow 有产物校验规则和 Phase 检查清单，但缺少一个统一的 artifact validator / reconcile 机制，能够在 resume 前自动对齐四个事实维度：`execution-state`、关键产物、Beads 状态、git diff / commit hash。

## 目标

1. 建立 `execution-state` 优先的四源对齐规则。
2. 实现每次 resume 前自动执行的轻量 reconcile 检查。
3. 定义低风险不一致自动修复规则和高风险不一致的人工确认流程。
4. 把 reconcile 差异报告写入 `.workflow/reconcile-report.md`，供问题排查使用。

---

## 方案设计

### 四源优先级规则

```
execution-state  → 决定从哪里恢复（流程游标）
关键产物         → 决定阶段是否真的完成（事实证据）
Beads 状态       → 决定任务协作状态是否一致（任务事实）
git diff/hash    → 决定代码改动事实是否可追溯（代码事实）
```

`execution-state` 是 resume 的入口，但不能单独证明阶段完成；必须用关键产物、Beads 状态和 git diff 做校验后才能推进。

### Reconcile 流程

每次 resume 前，按以下步骤执行：

```
Step 1: 读取 execution-state.md，确定声明的 current_phase 和 artifact_paths
Step 2: 按 artifact_paths 逐项校验产物是否存在、结构是否合法
Step 3: 查询 Beads，比对任务状态与 execution-state 中的阶段状态
Step 4: 执行 git log --oneline，检查 commit_hash 是否与声明一致
Step 5: 汇总差异，生成 reconcile-report.md
Step 6: 分类处理：低风险自动修复，高风险阻断并请求确认
```

### 不一致分类与处理

#### 低风险不一致（自动修复）

| 不一致类型 | 自动修复动作 |
| --- | --- |
| `execution-state` 缺少产物路径字段 | 扫描产物目录后补全路径字段 |
| 产物存在但 `execution-state` 未推进到对应阶段 | 将 state 推进到已验证通过的阶段 |
| Beads 任务状态与 state 轻微不同步（如顺序差异） | 记录差异，不阻断，生成 warn 提示 |
| 缺失非关键目录 | 自动创建目录，写入审计日志 |

#### 高风险不一致（阻断，请求人工确认）

| 不一致类型 | 阻断原因 |
| --- | --- |
| `execution-state` 标记完成但核心产物缺失 | 流程事实不可信，不能恢复 |
| 产物结构不满足契约（如 PRD 缺少必要字段） | 产物不合格，下游阶段无法使用 |
| Beads 已关闭但代码 diff 不存在或与声明不符 | 代码事实不一致，可能已有外部修改 |
| `execution-state` 中 commit_hash 与 git log HEAD 不符 | 代码可能被手动回退或外部改动 |

### Reconcile 报告格式

写入 `.workflow/reconcile-report.md`：

```markdown
# Reconcile Report

生成时间：2026-05-21T10:00:00Z
当前阶段：02-prd

## 产物校验

- [OK] artifacts/prd/prd.md (存在, 大小: 12.3KB)
- [MISSING] artifacts/prd/domain-context.md

## Beads 状态

- Task #42: execution-state=done, beads=done [OK]
- Task #43: execution-state=done, beads=in_progress [WARN]

## Git 校验

- 声明 commit_hash: abc1234
- git log HEAD: abc1234 [OK]

## 自动修复动作

- [AUTOFIX] 补全 artifact_paths.domain_context 路径 -> null（产物缺失，已标记 warn）

## 需要人工确认

- [BLOCK] artifacts/prd/domain-context.md 缺失，无法推进到 03-tech-design
  建议：重新生成 domain-context 或手动确认可跳过
```

### execution-state 新增字段

```yaml
reconcile_status: "pass"           # pass / warn / blocked / autofix_done
last_reconcile_at: "2026-05-21T10:00:00Z"
reconcile_report_path: ".workflow/reconcile-report.md"
```

### 命令入口

```bash
# 独立命令，手动触发完整 reconcile
$BD_BIN reconcile [--phase 02-prd] [--fix] [--report-only]

# resume 前自动触发（内置在 Orchestrator pre-resume 步骤中）
```

---

## 文件变更清单

| 文件 | 变更说明 |
| --- | --- |
| `.workflow/scripts/reconcile.js` | 新增，Reconcile 核心逻辑 |
| `.workflow/reconcile-report.md` | 运行时生成，差异报告 |
| `execution-state.md` | 新增 `reconcile_status`、`last_reconcile_at`、`reconcile_report_path` 字段 |
| `skills/mrd-to-code-v2/SKILL.md` | 在 resume 流程前增加 reconcile 步骤说明 |
| `.mrd-to-code-config.json` | 可选：新增 `reconcile.auto_fix`、`reconcile.block_on_missing` 配置项 |

---

## 验收标准

1. 每次 resume 前，reconcile 脚本自动运行；静默通过时不输出任何信息。
2. 低风险不一致由 reconcile 脚本自动修复，修复结果写入审计日志。
3. 高风险不一致阻断流程，输出清晰的人工确认提示和建议操作。
4. `.workflow/reconcile-report.md` 在每次 reconcile 后更新，格式符合规范。
5. `execution-state.md` 包含 `reconcile_status` 字段，取值为 `pass / warn / blocked / autofix_done`。

---

## 风险与注意事项

1. **误判高风险**：产物路径配置不准确可能导致合法产物被判为缺失，需在契约配置中精确声明必需产物列表。
2. **Beads 不可用**：若 Beads 服务不可访问，应降级为跳过 Beads 一致性检查，而不是阻断整个流程。
3. **大型 git diff**：reconcile 中仅检查 commit hash 是否一致，不做全量 diff 分析，避免超时。
