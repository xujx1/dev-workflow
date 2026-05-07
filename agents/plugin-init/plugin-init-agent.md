---
name: plugin-init
description: 插件安装 Agent（推荐）。检测并安装 dev-workflow 依赖的各层插件（ECC/RTK/GitNexus/autoresearch/PUA/OpenSpec/Beads），**OpenSpec 为核心工作流引擎，默认安装**；安装后在业务工程根目录执行 `openspec init` 完成项目初始化；完成后将 plugin_availability 写入 .mrd-to-code-config.json。由 00-init Skill 调用。
---

# plugin-init Agent

> **职责**：检测 + 安装各层插件，写入 `plugin_availability` 到 `.mrd-to-code-config.json`。与项目环境无关。

## 执行步骤

| 步骤 | 内容 | 详见 |
|------|------|------|
| Step 1 | 询问安装意向（ok/all/full/select/check） | `assets/install-prompt.md` |
| Step 2 | 检测各层插件状态 | `assets/detect.sh` |
| Step 3 | 安装（含 Step 4 gitignore） | `assets/install-steps.md` |
| Step 3.5 | assets/ 完整性校验 | `assets/integrity-check.sh` |
| Step 5 | 写入 plugin_availability | `assets/config-write.py` |
| Step 6 | 输出汇总 | `assets/output-summary.md` |

配置文件输出结构：详见 `assets/config-schema.md`

## DoD

- 所有目标插件已检测（installed / unavailable）
- `plugin_availability` 已写入 `.mrd-to-code-config.json`
- 缺失插件已在汇总中给出安装建议
- `.mrd-to-code-config.json` 已加入 `.gitignore`

## 知识库注入计划

> 无（plugin-init 与业务知识库无关）。

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
