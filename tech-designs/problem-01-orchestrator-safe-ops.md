# 技术方案：Orchestrator 安全微操作白名单

## 背景

当前设计要求 Orchestrator 只调度、不产出，以防止主会话越权并保证产物来源清晰。但实践中存在一类低风险基础设施操作（如补齐目录、修复状态元数据、校验产物存在性、执行 reconcile），若全部绕 Agent 处理会显著增加调度成本，也会使 Skill 持续膨胀，导致主 Agent 在长流程中上下文被流程说明打满。

## 目标

1. 定义"安全微操作白名单"，允许 Orchestrator 执行可机械执行、低风险、可审计的基础设施动作。
2. 明确哪些操作继续禁止（生成业务产物、代码、测试、Review 结论）。
3. 建立微操作的审计日志规范，保证可追溯。
4. 收缩 Skill 的职责边界，把修复逻辑下沉为脚本或命令。

---

## 方案设计

### 白名单分类

将 Orchestrator 允许执行的操作分为以下四类：

| 类型 | 操作示例 | 风险级别 |
| --- | --- | --- |
| 目录修复 | 创建缺失的 `artifacts/`、`output/` 目录 | 低 |
| 状态修复 | 补全 `execution-state.md` 中缺失的字段，同步产物路径 | 低 |
| 产物校验 | 检查阶段关键产物是否存在、大小是否合理 | 低 |
| Reconcile 报告 | 对比 `execution-state`、Beads、git diff，生成差异摘要 | 低（只读+生成报告） |

**明确禁止清单（Orchestrator 不得触及）：**

- 生成业务逻辑代码
- 生成测试代码
- 输出 PRD / 技术方案 / OpenSpec 产物
- 做 Code Review 结论
- 写入 Beads 任务状态（只读允许）
- 修改业务知识库内容

### 白名单实现形式

#### 方案 A：内联白名单配置（推荐）

在 `.workflow/orchestrator-safe-ops.yml` 中声明允许的操作类型：

```yaml
safe_ops:
  - id: ensure_dir
    description: "创建缺失目录"
    allowed_paths:
      - "artifacts/"
      - "output/"
      - ".workflow/"
    audit: true

  - id: fix_execution_state
    description: "修复 execution-state.md 缺失字段"
    allowed_fields:
      - "current_phase"
      - "artifact_paths"
      - "started_at"
      - "last_updated_at"
    disallowed_fields:
      - "review_conclusion"
      - "test_result"
    audit: true

  - id: validate_artifacts
    description: "校验关键产物存在性"
    check_only: true
    audit: false

  - id: reconcile_report
    description: "生成 reconcile 差异报告（只读）"
    output: ".workflow/reconcile-report.md"
    audit: true
```

#### 方案 B：下沉为脚本命令

可机械执行的操作统一抽取为独立脚本，Orchestrator 通过脚本调用执行，不直接嵌入修复逻辑：

```
.workflow/
  scripts/
    ensure-dirs.sh          # 创建标准目录结构
    fix-execution-state.js  # 修复状态字段
    validate-artifacts.js   # 产物存在性校验
    reconcile.js            # 差异报告生成
```

**推荐方案 A + 方案 B 结合**：白名单配置声明允许的操作，脚本负责具体执行，Orchestrator 只做调用。

### 审计日志规范

所有白名单操作执行后，追加写入 `.workflow/ops-audit.log`，格式为 JSONL：

```jsonl
{"ts": "2026-05-21T10:00:00Z", "op": "ensure_dir", "path": "artifacts/prd", "result": "created"}
{"ts": "2026-05-21T10:00:01Z", "op": "fix_execution_state", "field": "artifact_paths.prd", "before": null, "after": "artifacts/prd/prd.md", "result": "ok"}
{"ts": "2026-05-21T10:00:02Z", "op": "validate_artifacts", "phase": "02-prd", "artifacts": ["prd.md"], "missing": [], "result": "pass"}
```

日志只追加，不修改，不参与 `execution-state` 推进决策。

### Skill 边界收缩原则

Skill 职责收缩为三类描述：

1. **边界和原则**：说明当前阶段允许做什么、不允许做什么。
2. **入口和触发条件**：何时进入、何时退出、何时升级为 Agent 调用。
3. **验收标准**：阶段完成的判定依据。

修复流程、目录创建、状态同步等机械操作不应写入 Skill 上下文，应通过 safe-ops 白名单或脚本命令执行。

---

## 文件变更清单

| 文件 | 变更说明 |
| --- | --- |
| `.workflow/orchestrator-safe-ops.yml` | 新增，定义白名单操作列表 |
| `.workflow/scripts/ensure-dirs.sh` | 新增，目录修复脚本 |
| `.workflow/scripts/fix-execution-state.js` | 新增，状态字段修复脚本 |
| `.workflow/scripts/validate-artifacts.js` | 新增，产物校验脚本 |
| `.workflow/scripts/reconcile.js` | 新增，差异报告生成脚本 |
| `.workflow/ops-audit.log` | 运行时生成，微操作审计日志 |
| `skills/mrd-to-code-v2/SKILL.md` | 更新 Orchestrator 职责说明，引用白名单规则 |

---

## 验收标准

1. Orchestrator 执行目录创建、状态修复、产物校验时不再内联大段流程说明，每类操作均通过白名单调用或脚本命令完成。
2. 所有白名单操作执行后均有 `.workflow/ops-audit.log` 记录，包含时间戳、操作类型、参数和结果。
3. 业务产物生成、测试代码生成、Review 结论输出等禁止操作，在 Orchestrator 层没有调用入口。
4. 主 Skill 文件中修复相关描述不超过原章节的 30%（下沉前后对比）。

---

## 风险与注意事项

1. **白名单过宽**：需定期 review，防止随需求增加而无限扩展，演变成隐式的业务逻辑入口。
2. **脚本幂等性**：修复脚本应无副作用且幂等，执行两次不影响最终状态，避免并发或重复触发引发不一致。
3. **审计日志增长**：长期运行后 `ops-audit.log` 可能较大，可按需配置日志滚动策略，默认不主动清理。
