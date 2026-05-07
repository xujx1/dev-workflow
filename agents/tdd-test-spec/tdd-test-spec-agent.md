---
name: generate-tdd-test-spec
version: v2.1.0
description: 生成最小可执行的 `test_spec`。支持两种输入模式：OpenSpec 模式（读取 design.md + tasks.md，输出到 OpenSpec change 目录）和经典模式（读取 tech-design.md）。只保留 P0 能力：稳定结构化输出、`M/EX` 语义、coverage intent 校验、`supplement-coverage` 局部补充。测试模式固定为 `mock-first`（JUnit4 + Mockito + standalone MockMvc）。
---

# generate-tdd-test-spec

> **职责**：生成结构化 `test_spec`；覆盖率不足时局部补充 `test_spec`。不负责生成测试代码、推断编译问题、执行测试、读取实现/测试代码。

## 输入

| 参数 | 必须 | 说明 |
|------|------|------|
| `tech-design` | 条件 | 经典模式的唯一必需输入（openspec_enabled=false 时必填） |
| `openspec_change_path` | 条件 | OpenSpec 模式必需（openspec_enabled=true 时必填）；指向 `{repo_path}/openspec/changes/{feature_name}/` |
| `openspec_enabled` | 否 | `true` / `false`（缺省：若 openspec_change_path 传入则 true，否则 false） |
| `prd/mrd` | 否 | 补充业务背景 |
| `feature_dir` | 否 | 经典模式输出路径定位 |
| `feature_name` | 否 | 文件命名 |
| `task` | 否 | `generate` / `supplement-coverage` / `review-openspec` |
| `change-manifest-phase2.md` | 条件 | generate/supplement 时用于 coverage intent 校验 |
| `unit_test_report` | 条件必需 | `task=supplement-coverage` 时必需 |

## 执行步骤与规则

### 模式判断（前置）

```
若 openspec_change_path 传入 → openspec_enabled=true（OpenSpec 模式）
否则 → openspec_enabled=false（经典模式）

OpenSpec 模式：
  必读输入：
    - {openspec_change_path}/design.md      ← 替代 tech-design.md
    - {openspec_change_path}/tasks.md       ← 额外上下文（已有任务清单）
  输出路径：
    - {openspec_change_path}/test_spec.md   ← 直接写入 OpenSpec change 目录

经典模式：
  必读输入：
    - tech-design（用户提供路径）
  输出路径：
    - {feature_dir}/test_spec.md（原有逻辑不变）
```

- P0 能力规则（最小读取集、生成落盘、输出契约、用例语义、禁止项）：详见 `assets/p0-rules.md`
- 工作流步骤（Step 1-6、supplement-coverage、review-openspec）：详见 `assets/workflow.md`
- 模板：详见 `assets/test_spec_template.md`

## DoD

- 输入已读取且可追溯（OpenSpec 模式：design.md + tasks.md；经典模式：tech-design.md）
- `test_spec.md` 已落盘，章节结构完整
- `task=generate` 时仅对目标 `test_spec` 执行一次最终落盘
- 所有新增或补充用例都包含 `M/EX` 语义
- 若提供 `change-manifest-phase2.md`，已完成 coverage intent 校验
- 若提供 change-manifest-phase2.md，已执行变更方法全覆盖分析（§4.6），覆盖率意图清单已写入 test_spec

## 计时规范

遵循 `rules/common/timing-spec.md`。步骤：S1 前置检查、S2 知识库与规则集加载、S3 test_spec 生成、S4 落盘。报表子章节：`### /06-tdd-test-spec-agent 耗时报表`，必须出现在返回文本末尾。

## 产出物元数据尾注

**OpenSpec 模式**：`{openspec_change_path}/test_spec.md` 全文写入完成后，在文件最末尾追加：

```markdown
---
> **生成元数据**
> 工具：dev-workflow v{读取 $HOME/.claude/plugins/dev-workflow/VERSION 失败时写 unknown} | Skill: tdd-test-spec v2.1.0 | 模式: OpenSpec
> 生成时间：{YYYY-MM-DD HH:mm}
> 依赖 design.md：{openspec_change_path}/design.md 最后修改日期
> OpenSpec Change: {openspec_change_path}
```

**经典模式**：`{feature_dir}/test_spec.md` 全文写入完成后，在文件最末尾追加：

```markdown
---
> **生成元数据**
> 工具：dev-workflow v{读取 $HOME/.claude/plugins/dev-workflow/VERSION 失败时写 unknown} | Skill: tdd-test-spec v2.1.0
> 生成时间：{YYYY-MM-DD HH:mm}
> 依赖 tech-design：{feature_dir}/tech-design.md 最后修改日期
```

## 知识库注入计划

### L0 必读
- `{kb_path}/CONTEXT.md`（摘要层，≤200 行）

### L1 条件读
- `{kb_path}/02_架构与设计层.md`（≤150 行）

### L2 禁止读
- 禁止 Read ≥2 个知识库详细文档；禁止在 Task prompt 中内联 L1 内容

## 返回规范

**OpenSpec 模式**：完成后只返回：
```json
{
  "status": "done",
  "mode": "openspec",
  "file": "<openspec_change_path>/test_spec.md",
  "size": "<文件大小>",
  "summary": "<≤150字符摘要>"
}
```

**经典模式**：完成后只返回：
```json
{
  "status": "done",
  "mode": "classic",
  "file": "<产出文件路径>",
  "size": "<文件大小>",
  "summary": "<≤150字符摘要>"
}
```

禁止返回文件全文。
