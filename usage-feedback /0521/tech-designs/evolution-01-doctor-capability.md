# 技术方案：Doctor 诊断能力

## 背景

当前 dev-workflow 各 Stage 在运行时才会暴露配置缺失、权限不足、状态不一致或插件版本落后等问题，导致流程跑到一半才中断，修复成本较高。

缺少一个统一的健康检查机制（doctor capability），在流程启动前或 Stage 切换时做轻量预检，提前发现并处理可预防的故障。

## 目标

1. 定义 doctor capability 的三层结构：pre-stage 轻量检查、doctor-agent 复杂诊断、doctor command 手动排障。
2. pre-stage 轻量检查集成到主流程，正常时静默，异常时给出简短提示或阻断。
3. 定义可自动修复项和必须阻断项，明确分级处理规则。
4. 检查结果输出结构化状态（`pass` / `warn` / `block` / `autofix_done`），供 Orchestrator 判断是否继续。

---

## 方案设计

### 三层结构

```
doctor capability
├── pre-stage lightweight checks
│     职责: 主流程内置，每个 Stage 前执行，正常静默，异常提示或阻断
│     执行方: Orchestrator 内嵌（轻量脚本或简单检查列表）
│     输出: pass / warn / block / autofix_done
│
├── doctor-agent
│     职责: 复杂诊断，聚合多项证据，生成完整诊断报告
│     执行方: 独立 Sub-Agent，由 Orchestrator 在需要时调用
│     触发条件: pre-stage 返回 block 且无法自动修复，或用户主动运行 doctor command
│
└── doctor command
      职责: 手动排障入口，初始化后自检、升级后验证、用户主动诊断
      执行方: 用户主动触发
      输出: 详细诊断报告（.workflow/doctor-report.md）
```

### Pre-Stage 轻量检查项

| 检查项 | 分类 | 异常处理 | 说明 |
| --- | --- | --- | --- |
| `.mrd-to-code-config.json` 是否存在且合法 | config | block | 缺少则无法确定技术栈 |
| `execution-state.md` 格式是否合法 | state | autofix + warn | 简单格式错误可自动修复 |
| 关键产物是否存在（按当前 Stage 判断） | artifact | warn / block | 上一 Stage 产物缺失则 block |
| Beads 任务状态与 execution-state 是否一致 | consistency | warn | 不一致时提示，不自动阻断 |
| 飞书 MCP 权限和 scope 是否满足当前 Stage | permission | warn / block | 缺少读写权限则 block |
| 插件版本（OpenSpec / GitNexus / Beads）是否可用 | plugin | warn | 版本落后时提示，不阻断 |
| 知识库 Freshness Score 是否低于阈值 | knowledge | warn | 分值低时提示刷新 |
| 模型路由配置是否可用（有 baseline 可用） | model | warn | 无法解析模型时退化并提示 |

### 输出状态定义

| 状态 | 含义 | Orchestrator 行为 |
| --- | --- | --- |
| `pass` | 所有检查通过 | 静默继续，不输出任何提示 |
| `warn` | 存在风险但不阻断 | 输出简短提示，继续执行 |
| `block` | 发现阻断性问题 | 输出提示，等待用户修复或 doctor-agent 诊断 |
| `autofix_done` | 发现问题并已自动修复 | 输出"已自动修复：XXX"，继续执行 |

### 可自动修复项

| 问题 | 自动修复动作 |
| --- | --- |
| `execution-state.md` 中 `current_stage` 字段缺失 | 根据已有产物推断当前阶段，补写字段 |
| 关键目录不存在（如 `.workflow/`） | 自动创建目录 |
| reconcile_status 字段缺失 | 补写为 `"unknown"`，触发下次 reconcile |
| 模型路由未配置 | 退化为 baseline 单模型模式，写入提示 |

### Doctor Report 格式（doctor command 输出）

```markdown
# Doctor Report

**生成时间**: 2026-05-21T10:00:00Z
**当前 Stage**: 03-code-gen
**整体状态**: warn

## 检查结果

| 检查项 | 状态 | 详情 |
| --- | --- | --- |
| 配置文件 | pass | .mrd-to-code-config.json 合法 |
| execution-state | autofix_done | 补写了缺失的 reconcile_status 字段 |
| 关键产物 | pass | PRD 和技术方案产物存在 |
| 飞书权限 | warn | 缺少 wiki:write scope，归档阶段可能受影响 |
| 插件版本 | warn | OpenSpec 版本 1.2.0，最新为 1.4.0 |
| 知识库新鲜度 | pass | Freshness Score = 78（阈值 60） |
| 模型路由 | pass | 已解析 baseline = claude-sonnet-4 |

## 建议操作

1. [warn] 飞书权限：请在飞书 OAuth 中添加 wiki:write scope，否则 Stage 04 归档会失败。
2. [warn] OpenSpec 插件：建议运行 npx skills upgrade openspec 升级到 1.4.0。
```

### 执行时机

```
主流程执行时机：
- 每个 Stage 开始前自动执行 pre-stage 轻量检查
- 检查耗时目标 < 2s，不影响用户体验

独立触发时机：
- 用户主动运行：mrd doctor 或 mrd doctor --full
- 初始化完成后自检：00-init 最后一步
- 插件版本升级后验证：mrd-upgrade 后自动触发
```

---

## 文件变更清单

| 文件 | 变更说明 |
| --- | --- |
| `.workflow/scripts/doctor-check.js` | 新增，pre-stage 轻量检查逻辑 |
| `.workflow/doctor-report.md` | 运行时生成，doctor command 输出 |
| `execution-state.md` | 新增 `doctor_status` 字段（最近一次 pre-stage 结果） |
| `skills/mrd-to-code-v2/SKILL.md` | 新增 pre-stage doctor 触发说明 |

---

## 验收标准

1. 每个 Stage 开始前执行 pre-stage 检查，`pass` 时无任何输出。
2. `warn` 时输出简短一行提示，不阻断流程。
3. `block` 时明确说明阻断原因和修复建议，Orchestrator 不继续下一步。
4. `autofix_done` 时输出"已自动修复"说明，继续执行。
5. `mrd doctor` 命令生成完整 `.workflow/doctor-report.md`，包含所有检查项状态和建议。

---

## 风险与注意事项

1. **检查成本**：pre-stage 检查必须轻量，目标 < 2s，避免成为流程瓶颈。复杂诊断放入 doctor-agent，不放入 pre-stage。
2. **误报率**：`block` 级别的判断需谨慎，避免因误报频繁阻断流程降低用户信任。
3. **第一阶段范围**：建议第一阶段只落地配置文件、execution-state 格式、关键产物存在性三项检查，其他项后续逐步增加。
