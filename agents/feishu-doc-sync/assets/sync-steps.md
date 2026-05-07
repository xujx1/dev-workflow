# 飞书文档同步 Agent — 执行步骤与保真策略

## 适用范围

当前优先支持：

- PRD：Stage 1 上传 `{feature_dir}/prd.md`；MODE B 回读飞书最新内容（内存使用，**不落盘**）
- 技术方案：上传 `{feature_dir}/tech-design.md`；归档时从飞书 URL 直接读取（内存使用，**不落盘**）
- 归档报告：上传 `{feature_dir}/archive-report.md`

后续可扩展到：MRD 归档、测试规格

## 输入

| 参数 | 必须 | 说明 |
|------|------|------|
| `mode` | 是 | `upload` 或 `read` |
| `doc_kind` | 是 | `prd` / `tech-design` / `archive-report` / `generic` |
| `feature_dir` | 是 | 需求目录，用于定位本地文件与状态文件 |
| `source_path` | 否 | 本地源文件路径；`upload` 模式必填 |
| `doc_title` | 否 | 上传到飞书的标题；`upload` 模式建议传入 |
| `doc_url` | 否 | 飞书文档 URL；`read` 模式必填，`upload` 模式为可选复用 |
| `parent_url` | 否 | 飞书文档父级目录/Wiki 位置；仅 `upload` 模式使用 |
| `state_file_path` | 否 | 状态文件路径，默认 `{feature_dir}/execution-state.md` |
| `state_url_field` | 否 | 需要写入的 URL 字段，如 `prd_feishu_url` / `tech_design_feishu_url` |

> 硬约束：`upload` 模式传入的 `source_path` 必须是完整本地路径。
> 当 `doc_kind=prd` 时，`source_path` 必须为 `{feature_dir}/prd.md`；若只传裸文件名，必须停止并返回错误。

## 模式 A：上传 `upload`

1. `Read {source_path}` 读取本地 Markdown 全文
2. 执行 Markdown 预检，识别以下高风险结构：
   - Mermaid 代码块：```mermaid
   - 流程图关键字：`flowchart TD` / `flowchart LR`
   - 时序图关键字：`sequenceDiagram`
   - 状态机关键字：`stateDiagram-v2`
3. 对文档做飞书导入预处理：
   - 保留标题、列表、表格、普通代码块原样
   - 去除重复 H1（若 `doc_title` 已单独传入）
   - 记录 Mermaid / 图表块数量，生成 `format_risk_summary`
   - 若 `doc_kind=prd`：必须校验文档包含「背景 / 目标 / 角色/场景 / 功能变更 / 业务规则 / 验收标准（AC） / 边界/待确认」以及 `附录A/B/C`
   - 若 `doc_kind=prd`：即使担心飞书导入体积或格式降级，也**不得**退化成"只上传背景+目标+本地路径提示"的极简版本
   - 若 `doc_kind=prd` 且确实需要裁剪：优先压缩 `附录B/附录C` 的冗长细节，正文七节必须完整保留，并保留 `附录A：原始完整 PRD` 标题与正文摘要
4. 调用 MCP `mcp__front_feishu__feishu_create_doc(title={doc_title}, content={content}, parentUrl={parent_url})` 上传文档
5. 若配置了 `state_url_field`，将返回 URL 写入状态文件
6. 立即对新文档执行一次 `mcp__front_feishu__feishu_get_doc_content(url={doc_url})` 回读
7. 做结构级校验，至少比较：
   - 一级/二级标题数量
   - 表格数量
   - 代码块数量
   - Mermaid / 流程图块是否被降级为普通代码块
8. 返回同步结果：

```json
{
  "mode": "upload",
  "doc_url": "https://your-domain.feishu.cn/docx/xxx",
  "state_url_field": "prd_feishu_url",
  "format_risk_summary": [
    "检测到 2 个 Mermaid 代码块，当前 MCP 导入后可能降级为普通代码块"
  ],
  "roundtrip_check": "pass|warn|fail"
}
```

## 模式 B：读取 `read`

1. 调用 MCP `mcp__front_feishu__feishu_get_doc_content(url={doc_url})` 拉取飞书 Markdown
2. **直接返回内容**（内存传递给调用方），**不落盘本地文件**
3. 若配置了 `state_url_field` 且状态文件中该字段为空，则补写 URL
4. 返回结果：

```json
{
  "mode": "read",
  "doc_url": "https://your-domain.feishu.cn/docx/xxx",
  "content": "<飞书文档 Markdown 内容>"
}
```

## 对 Skill/Orchestrator 的约束

- `02-implementation-plan`：
  - Stage 1 完成后，必须默认调度本 Agent 的 `upload` 模式上传 `{feature_dir}/prd.md`
  - 同时调度本 Agent 的 `upload` 模式上传 `{feature_dir}/tech-design.md`
  - **禁止**直接调用 `mcp__front_feishu__feishu_create_doc`，必须通过本 Agent
- `archive-report-agent`：
  - 节2 PRD 覆盖度对比时，调度本 Agent 的 `read` 模式读取飞书 PRD 最新内容
  - 上传归档报告时，调度本 Agent 的 `upload` 模式

## 保真策略

当前底层 MCP 仅提供"Markdown 整体导入"和"整文回读"能力，因此本 Agent 的 V1 策略是：

- 优先保证文本结构一致
- 对 Mermaid/流程图块做风险识别与回读校验
- 若发现图表被降级为普通代码块，必须显式返回 `warn`
- 禁止在存在格式降级时仍向上层宣称"与本地完全一致"
- 对 `doc_kind=prd`，优先保证产品可读正文七节完整保真，其次才是附录细节完整度

V2 可扩展方向：

- 上传前将 Mermaid 渲染为图片并插入飞书
- 扩展更细粒度的飞书文档块级 MCP
- 增加本地 Markdown 与飞书回读内容的结构 diff 报告

## 产出

- 飞书文档 URL（上传模式）
- 飞书文档内容字符串（读取模式，内存传递）
- 状态文件 URL 字段更新
- 同步结果与保真校验摘要
