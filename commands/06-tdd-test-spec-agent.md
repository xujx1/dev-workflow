---
description: 根据技术方案、PRD/MRD 和测试知识库生成标准化 test_spec 测试规格文档。技术方案为必须输入。
argument-hint: [tech-design 路径 | task=generate | task=supplement-coverage | task=review-openspec]
---

# /06-tdd-test-spec-agent — 生成测试规格（test_spec）

直接调用 `tdd-test-spec-agent` 的斜杠命令入口。实际工作流在 `agents/tdd-test-spec/tdd-test-spec-agent.md`。

## 说明

生成最小可执行的 `test_spec_{feature_name}.md`，供 `testcode-gen-agent` 消费。

支持三种任务模式：

| 参数 | 模式 | 说明 |
|------|------|------|
| `task=generate`（默认） | 生成 | 生成结构化 test_spec |
| `task=supplement-coverage` | 增量补充 | 仅补覆盖率缺口场景 |
| `task=review-openspec` | OpenSpec 边界复查 | 只做边界互审，不重写全文 |

## 前置要求

- **必须**提供 `tech-design` 文档路径，缺失时立即停止
- 可选提供 PRD/MRD 补充业务背景
- 默认只读取最少规则集，不做全量知识库扫描

## 调用方式

直接调用 `agents/tdd-test-spec/tdd-test-spec-agent.md`。

**参数**：`$ARGUMENTS` — tech-design 文档路径及可选的 `task=` 参数。

## 推荐用法

- `/06-tdd-test-spec-agent req/xxx/tech-design.md`
  - 全量生成 test_spec
- `/06-tdd-test-spec-agent req/xxx/tech-design.md task=supplement-coverage`
  - 覆盖率不足时补充测试场景
- `/06-tdd-test-spec-agent req/xxx/tech-design.md task=review-openspec`
  - OpenSpec 边界复查

## 计时规范

遵循 `rules/common/timing-spec.md`。步骤定义：

| 步骤编号 | 步骤名称 |
|---------|---------|
| S1 | 前置检查（tech-design 文档读取与校验） |
| S2 | 知识库与规则集加载 |
| S3 | test_spec 生成 / 补充覆盖率 / OpenSpec 复查 |
| S4 | test_spec 文档落盘 |

报表子章节：`### /06-tdd-test-spec-agent 耗时报表`。
