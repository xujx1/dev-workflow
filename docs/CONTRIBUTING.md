# 贡献指南

感谢你的兴趣。以下是参与贡献的方式和规范。

---

## 贡献方式

- **Bug 报告**：通过 GitHub Issue 提交，附上复现步骤和错误信息
- **功能建议**：通过 GitHub Issue 描述使用场景和预期行为
- **代码贡献**：Fork → 修改 → 提 PR，请先确认对应的 Issue 存在

---

## 项目结构说明

在修改之前，建议先阅读：

- `docs/ARCHITECTURE.md`：了解整体架构和各模块职责
- `SKILL.md`：理解主编排流程
- 对应的 `agents/{name}/{name}-agent.md`：了解你要修改的 Agent 职责

---

## Agent 文件规范

每个 Agent 文件应包含以下章节：

```markdown
---
name: agent-name
description: 一句话描述，包含触发词
---

# Agent 标题

## 职责
## 输入（参数表格）
## 执行步骤
## 知识库注入计划（L0/L1/L2 分层）
## 返回规范
```

**知识库注入层级约束**（P0 硬约束，必须遵守）：
- L0：`CONTEXT.md`，≤200 行，必读
- L1：按职责最多读 1 个详细文档
- L2：禁止读 ≥2 个详细文档

**返回格式**（P0 Token 优化硬约束）：

```json
{
  "status": "done",
  "file": "<产出文件路径>",
  "size": "<文件大小>",
  "summary": "<≤150字符摘要>"
}
```

禁止在返回中包含文件全文。

---

## 修改现有 Agent 的注意事项

1. 确认修改不破坏 `execution-state.md` 的状态格式（否则会影响断点续传）
2. 涉及知识库读取逻辑的修改，检查是否违反 L0/L1/L2 分层约束
3. 修改编排逻辑时，同步更新 `docs/ARCHITECTURE.md` 的流程图

---

## 提交规范

Commit message 使用以下格式：

```
<type>: <简要描述>

类型：
  feat    新功能
  fix     Bug 修复
  docs    文档变更
  refactor  代码重构（不影响功能）
  test    测试相关
```

示例：
```
feat: add retry mechanism to tdd-test-runner
fix: fix state file not written when feishu upload fails
docs: update QUICK_START with feishu optional notes
```

---

## 本地验证

提交前建议手动验证：

```bash
# 检查是否有敏感信息残留
grep -rn "your-private-domain\|internal-token" . --include="*.md"

# 检查 Agent 文件是否包含必要章节
grep -l "知识库注入计划" agents/*/
```

---

## 行为准则

- 对 Issue 和 PR 保持友善和建设性
- 描述问题时提供足够的上下文，让维护者能复现
- 不在 Issues 中讨论与项目无关的内容
