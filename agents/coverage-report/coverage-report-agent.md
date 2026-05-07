---
name: coverage-report-agent
description: 测试覆盖率报告 Agent。读取 JaCoCo XML 报告，计算行/分支/方法覆盖率，
  输出结构化覆盖率摘要。由 archive-report-agent 或 testcode-gen-agent 调用。
  独立于 archive 流程可单独执行。
---

# 测试覆盖率报告 Agent

## 职责

从项目构建产物中提取 JaCoCo 覆盖率数据，生成结构化覆盖率摘要，供归档报告和质量门使用。

## 输入

| 参数 | 必须 | 说明 |
|------|------|------|
| `project_root` | 是 | Maven 项目根目录 |
| `feature_name` | 否 | 需求名称（用于报告命名） |
| `min_line_coverage` | 否 | 最低行覆盖率阈值，默认 80% |

## 执行步骤

> JaCoCo 查找/提取/质量门/摘要模板详见 `assets/jacoco-parser.md`。

| Step | 名称 | 说明 |
|------|------|------|
| 1 | 查找 JaCoCo 报告 | find jacoco.xml，详见 assets |
| 2 | 提取覆盖率数据 | 行/分支/方法覆盖率提取，详见 assets |
| 3 | 报告不存在时触发测试 | mvn test -Djacoco.skip=false，详见 assets |
| 4 | 质量门判断 | line_rate < min_line_coverage → BELOW_THRESHOLD，详见 assets |
| 5 | 输出覆盖率摘要 | Markdown 表格 + 结论，详见 assets |

## 产出

| 产出 | 说明 |
|------|------|
| `line_coverage` | 行覆盖率百分比字符串，供 archive-report-agent 填入报告核心指标表 |
| `coverage_summary` | 完整覆盖率摘要（Markdown 表格） |
| `coverage_result` | `PASS` / `BELOW_THRESHOLD` / `NA` |

## DoD

- JaCoCo XML 已定位或缺失原因已说明
- 行/分支/方法覆盖率已计算
- 质量门判断已完成
- 覆盖率摘要已输出

## 知识库注入计划

> 遵循 `rules/common/agents.md` 中「知识库注入计划模板（L0/L1/L2 分层，强制）」。

### L0 必读
- 无（本 Agent 不依赖知识库）

### L1 条件读
- 无

### L2 禁止读
- 禁止 Read 知识库文档

## 返回规范

> 遵循 `rules/common/agents.md` 中的「Agent 返回格式规范（P0 Token 优化硬约束）」。

完成后只返回结构化摘要，禁止返回文件全文：

```json
{
  "status": "done",
  "file": "<产出文件路径>",
  "size": "<文件大小>",
  "summary": "<≤150字符摘要>"
}
```
