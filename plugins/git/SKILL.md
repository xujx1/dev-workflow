---
name: git-plugin
version: v1.0.0
description: Git 输出保护插件。统一约束 git diff/show/log 等命令默认禁用 pager，并在大输出场景自动降级为逐文件读取，避免终端分页卡住。
type: plugin
trigger: global-git
---

# Git 输出保护插件

## 目标

解决以下常见问题：

- `git diff` 被 pager 截住，终端看起来像“没有输出”
- 大 diff 一次性输出过多，导致上下文不可控
- review / 归档 / 覆盖率脚本依赖 diff 时不稳定

---

## 硬规则

所有 Git 内容读取默认采用以下顺序：

1. 优先禁用 pager
2. 若输出仍过大，先取文件清单
3. 再按文件逐个读取 diff

### 标准命令

```bash
git --no-pager diff HEAD
git --no-pager diff --name-only HEAD
git --no-pager diff HEAD -- path/to/File.java
git --no-pager show <commit>
git --no-pager log -p -1
```

### 降级策略

若 `git diff` 没有正常吐出内容，必须自动切换为：

```bash
git --no-pager diff --name-only HEAD
git --no-pager diff HEAD -- <file-1>
git --no-pager diff HEAD -- <file-2>
```

---

## 适用场景

- `java-review-agent` 读取变更范围
- 归档阶段统计 AI 代码采纳率
- 覆盖率增量口径计算
- 人工/Agent 查看 PR 变更

---

## 与现有规则的关系

- 具体 diff 范围仍以各阶段 Skill/Agent 为准
- 本插件只负责**输出稳定性**
- 若与其他文档冲突，以“禁用 pager + 逐文件 fallback”规则为准
