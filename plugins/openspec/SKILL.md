---
name: openspec-plugin
version: v1.2.0
description: |
  OpenSpec 接口规格生成插件。
  在 Stage 2 技术方案完成后、Stage 3 代码生成前触发（条件触发，非强制）。
  默认启用，需求估算 ≥ 5人日时自动弹出确认门。
  可通过应用根目录 `.mrd-to-code-config.json` 按项目单独调整阈值或完全禁用。

  **核心工作流**：
  - Stage 2.5: `/opsx:new` + `/opsx:ff` → 生成 proposal/specs/design/tasks
  - Stage 3: `java-impl-agent` 读取 tasks.md 驱动实现（等效 `/opsx:apply`）
  - Stage 4: `/opsx:archive` → 归档变更
type: plugin
trigger: stage-2.5
---

# OpenSpec 接口规格生成插件

## 定位

OpenSpec 是一个**可选的质量门**，位于 Stage 2（技术方案）和 Stage 3（代码生成）之间：

```
Stage 2: 技术方案
    ↓
[Stage 2.5] OpenSpec（条件触发）← 本插件
    ↓
Stage 3: 代码生成 + TDD（由 tasks.md 驱动）
    ↓
Stage 4: 归档
```

**目的**：
1. 对于较大规模需求，在编码前生成结构化的任务清单（tasks.md）
2. `java-impl-agent` 读取 tasks.md 驱动实现，实现 `/opsx:apply` 的等效效果
3. 防止前后端或多服务间接口定义漂移

## OPSX 工作流集成

### 完整生命周期

```
/opsx:new {change_name}          → 创建变更目录（Stage 2.5 确认门）
    ↓
/opsx:ff                         → 快速生成 proposal + specs + design + tasks
    ↓
java-impl-agent 读取 tasks.md    → 等效 /opsx:apply（Stage 3）
    ↓
/opsx:archive                    → 归档变更（Stage 4）
```

### 与 java-impl-agent 的集成

| 阶段 | OpenSpec 产物 | java-impl-agent 行为 |
|------|--------------|---------------------|
| Stage 2.5 | `openspec/changes/{change_name}/` 创建 | 不参与 |
| Stage 3 Phase 1 | `tasks.md` + `specs/` 生成 | 读取 tasks.md 作为实现输入 |
| Stage 3 Phase 2-5 | - | 按 tasks.md 任务顺序实现代码 |
| Stage 4 | 归档到 `archive/` | 不参与 |

**关键点**：`java-impl-agent` 在编码前检查 OpenSpec 状态，若 `tasks.md` 存在则优先读取。

**与 code-changes.md 的本质区别**：

| 维度 | OpenSpec | code-changes.md（禁止产物） |
|------|---------|--------------------------|
| 形式 | 结构化 YAML / Markdown 契约 | 非结构化的变更描述文本 |
| 内容 | 接口字段定义、类型约束、版本号 | 说明「我改了什么」 |
| 消费者 | 前端联调、下游服务、测试 spec | 无明确消费者 |
| 时机 | 编码**前**，作为实现输入 | 编码**后**，变相替代修改代码 |

> **硬规则**：`java-impl-agent` 禁止生成任何形式的变更说明文件（code-changes.md、change-plan.md 等），必须直接修改 `.java` 源文件。OpenSpec 是接口契约，不是代码变更的替代。

---

## 触发条件

所有条件满足时自动弹出确认门：

| 条件 | 默认值 | 配置项 |
|------|--------|--------|
| 插件已启用 | `true` | `openspec.enabled` |
| 需求估算人日 ≥ 阈值 | `5` 人日 | `openspec.threshold_person_days` |

**需求估算来源**：优先使用技术方案中用户修订后的“需求复杂度估算”章节；若用户尚未修订，再回退 tech-design-agent 产出的首版估算（接口数 × 表数 × 外部系统数 → 换算人日）。

---

## 配置项（应用根目录 `.mrd-to-code-config.json`）

> **优先级**：当前应用根目录配置 > 全局默认值。  
> 也就是说，每个应用都可以在自己的仓库根目录放一份 `.mrd-to-code-config.json`，互不影响。

```json
{
  "openspec": {
    "enabled": true,
    "threshold_person_days": 5,
    "generate_stage": "before_code_gen",
    "archive_in_stage4": true
  }
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enabled` | boolean | `true` | 是否启用 OpenSpec 插件 |
| `threshold_person_days` | number | `5` | 触发阈值（人日），低于此值不触发 |
| `generate_stage` | string | `"before_code_gen"` | 生成时机，固定为 Stage 2 后 |
| `archive_in_stage4` | boolean | `true` | Stage 4 归档时是否归档 spec 目录 |

**项目内落点示例**：

```text
/path/to/your-app/.mrd-to-code-config.json
```

---

## 确认门交互

```
📋 OpenSpec 触发
本次需求估算：{N} 人日 ≥ {threshold} 人日阈值
接口变更数量：{N} 个（来自 tech-design 的接口变更清单）

建议生成接口 Spec 文档，原因：
- 规范接口契约，防止联调阶段接口漂移
- 为前端/下游服务提供清晰的接口定义

请选择：
[Y] 生成 Spec（继续 Stage 2.5）
[N] 跳过本次（直接进入 Stage 3）
[D] 永久禁用 OpenSpec（更新配置，本次也跳过）
[C] 调整阈值为 ___ 人日（更新配置，本次仍触发）
```

---

## 执行流程

### Step 1：Stage 2.5 确认是否启用 OpenSpec

Stage 2.5 只负责确认门，不直接写入 `spec/` 产物：
- 需求估算达到阈值时提示用户是否启用 OpenSpec
- 用户确认后，将 `openspec_enabled = true` 传递给 Stage 3

### Step 2：Stage 3 Phase 1 读取技术方案接口变更清单

优先从 `{feature_dir}/tech-design.md` 提取接口变更清单。

提取内容包括：
- 新增/修改的接口列表（路径、HTTP Method、请求/响应结构）
- Dubbo 接口变更（方法签名、入参、出参）
- MQ 消息结构变更（Topic/Tag、消息体字段）

### Step 3：Stage 3 Phase 1 生成 OpenAPI Spec

调用 `agents/openspec/openspec-archive-agent.md`

产出格式：
- HTTP 接口 → OpenAPI 3.0 YAML（`spec/openapi-{feature}.yaml`）
- Dubbo 接口 → 接口契约文档（`spec/dubbo-contract-{feature}.md`）
- MQ 消息 → 消息契约文档（`spec/mq-contract-{feature}.md`）

### Step 4：输出产物摘要

```
✅ OpenSpec 生成完成

产出目录：{feature_dir}/spec/
├── openapi-{feature}.yaml    ← HTTP 接口 Spec（OpenAPI 3.0）
├── dubbo-contract-{feature}.md ← Dubbo 接口契约
└── mq-contract-{feature}.md  ← MQ 消息契约

接口覆盖：{N} 个接口
规格行数：{N} 行

[继续 Stage 3] 继续代码生成主流程
```

---

## 归档集成（Stage 4）

当 `archive_in_stage4 = true` 且本次需求实际生成了 `spec/` 目录时，Stage 4 归档才将 `spec/` 目录包含在归档产物中，并在归档报告中添加 Spec 文件链接。
若本次需求未生成 OpenSpec，则 Stage 4 必须直接跳过 OpenSpec 归档，不得报错，不得阻塞归档主流程。

---

## 资产文件

- `agents/openspec/openspec-archive-agent.md` — OpenSpec 生成 Agent
