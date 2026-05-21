# PRD 校验规则

确认门前必须执行：

```bash
node .workflow/scripts/validate-prd.js --file "{feature_dir}/prd.md" --json
```

阻断条件：

- 缺少 `## 一、背景` 到 `## 七、边界 / 待确认` 任一章节。
- 一~七章节顺序错误。
- 出现 `附录`。
- 出现 `❓` 待确认标注。
- 出现非 Mermaid 代码块。
- 没有 Mermaid `flowchart`。
- 出现 ASCII art 或文本框图。
- 出现实现类、包名、`class#method` 或代码调用符号。
- 缺少 `生成元数据` 尾注。

通过条件：脚本返回 `status=pass`。
