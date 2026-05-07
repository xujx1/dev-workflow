# 需求跟踪报告模板

> 本文件定义需求跟踪报告的完整结构。
> 生成报告时先 Write 骨架（仅标题），再逐节 Edit 填充。
> 本报告是 Stage 4 的**正式需求跟踪报告**，本地文件固定为 `archive-report.md`。
> 标题和正文中禁止出现“草稿”“草案”“初稿”等表述。
> 所有模板占位符都必须在上传前被真实值替换，禁止保留 `{score}`、`{prd_coverage}` 等占位符。
> 所有评分结果统一使用数值百分比表达，不使用“高/中/低”等等级词。

---

## 报告骨架（Write 阶段）

```markdown
# {需求名称} — 需求跟踪报告

> 生成时间：{datetime}
> 需求目录：{feature_dir}
> OpenSpec 变更：{openspec_archive_status}
> AI 生成 commit：{ai_commit_hash}
> 归档代码快照：{archive_code_ref}
> {archive_code_note_or_empty}

---

## 核心指标

| 维度 | 百分比 |
|------|--------|
| MRD 标准度 | — |
| AI PRD 功能覆盖度 | — |
| AI 技术方案覆盖度 | — |
| AI 代码采纳率 | — |
| PRD 生成知识库命中率 | — |
| 技术方案知识库命中率 | — |
| 测试用例知识库命中率 | — |
| 测试行覆盖率 | — |
| 命中追踪 | 见节6 |

---

## 节1：MRD 标准度

## 节2：AI 生成 PRD 功能覆盖度

## 节3：AI 生成技术方案覆盖度

## 节4：AI 产出代码采纳率

## 节5：测试报告摘要

## 节6：命中追踪
```

---

## 节1：MRD 标准度（Edit 阶段）

读取 `{feature_dir}/mrd-original.md`，按 6 维度评分（每项 0-10 分，满分 60 分）：

| 维度 | 说明 | 分值 |
|------|------|------|
| 背景与目标 | 是否清晰描述业务背景、目标和成功指标 | /10 |
| 用户故事 | 是否有完整的用户角色和使用场景 | /10 |
| 功能需求 | 功能点是否明确、可量化 | /10 |
| 非功能需求 | 性能、安全、兼容性是否有说明 | /10 |
| 验收标准 | 是否有可测试的 AC | /10 |
| 边界与排除 | 是否明确了不在本期范围内的内容 | /10 |

输出：评分表 + 各项扣分原因 + 总分百分比，更新核心指标表。

---

## 节2：AI PRD 功能覆盖度（Edit 阶段）

数据源：
- AI 初版（飞书）：从 `execution-state.md` 读取 `prd_feishu_url`，调用 MCP `mcp__front_feishu__feishu_get_doc_content(prd_feishu_url)` 获取 AI 生成时的 PRD 初版
- 确认版（本地）：`{feature_dir}/prd.md`（本地即为确认版，可能经过用户编辑）

计算：提取 AI 初版所有功能点（`###`/`-` 粒度），逐条核对确认版中的保留状态。

覆盖率 = (完整保留 + 部分修改×0.5) / 总功能点数

输出表格 + 汇总行，更新核心指标表。

---

## 节3：AI 技术方案覆盖度（Edit 阶段）

数据源：
- AI 初版（飞书）：从 `execution-state.md` 读取 `tech_feishu_url`，调用 MCP `mcp__front_feishu__feishu_get_doc_content(tech_feishu_url)` 获取 AI 生成时的技术方案初版
- 确认版（本地）：`{feature_dir}/tech-design.md`（本地即为确认版，可能经过用户编辑）

粒度为设计决策点（方案选型、核心流程、接口定义、数据模型）。计算逻辑同节2。

---

## 节4：AI 代码采纳率（Edit 阶段）

```bash
# 获取 AI 生成的变更文件列表
git diff --name-only {ai_commit_hash}^ {ai_commit_hash}

# 对每个文件计算最终归档版本与 AI 初版的差异
git diff {ai_commit_hash} {archive_code_ref} -- {file}
```

整体采纳率 = 最终保留行数 / AI 新增总行数

前置校验：

```bash
git rev-parse --verify --quiet {ai_commit_hash}^{commit}
git rev-parse --verify --quiet {archive_code_ref}^{commit}
```

- 若两个 commit 都可解析：输出汇总数值 + 文件明细表，更新核心指标表
- 若任一 commit 不可解析：本节必须写明“缺少有效 commit 基线，暂不可计算”，核心指标表填 `—`，**禁止**写 `0%`

---

## 节5：测试报告摘要（Edit 阶段）

自动探测覆盖率报告路径（按序取第一个存在的）：
```
target/site/jacoco/index.html
build/reports/jacoco/test/html/index.html
target/jacoco.xml
```

输出：行覆盖率、分支覆盖率、方法覆盖率、测试用例总数、通过率，更新核心指标表。

若未找到覆盖率文件，输出：「未找到覆盖率报告，请运行测试后重新触发归档。」

---

## 节6：命中追踪（Edit 阶段）

阶段知识库命中率统一口径：

- 分母：对应阶段 `execution-state.md` 中“主要读取路径”总数
- 分子：
  - PRD 生成：`app-knowledge-base/`、`biz-knowledge/`
  - 技术方案：`app-knowledge-base/`、`biz-knowledge/`
  - 测试用例：`rules/test/`、`test-knowledge/`、`agents/tdd-test-spec/assets/`

输出要求：

- 核心指标表补齐：
  - `PRD 生成知识库命中率`
  - `技术方案知识库命中率`
  - `测试用例知识库命中率`
- 节 6 正文需同时给出这三条指标的百分比、分子分母和一句口径说明
