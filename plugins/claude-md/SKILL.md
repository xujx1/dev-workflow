---
name: claude-md-setup
version: v1.1.0
description: 配置 CLAUDE.md，将应用知识库 CONTEXT.md 写入首行，实现知识库上下文自动加载（≤200行 L0 层）。当用户说"配置CLAUDE.md"、"知识库上下文"、"CLAUDE.md"时触发。
user-invocable: true
---

# CLAUDE.md 知识库上下文配置

> 将应用知识库的 `CONTEXT.md`（L0 层，≤200行）写入 `CLAUDE.md` 首行，
> 让每次 Claude Code 会话自动加载知识库摘要上下文，无需重复维护。
>
> **L0/L1/L2 读取策略**：会话注入 CONTEXT.md，需要详情时按需读 L1（单模块/单接口），禁止全量读取。

---

## 前置检查

```bash
# 检查知识库是否存在（优先 CONTEXT.md，回退 00_概览.md 提示升级）
ls app-knowledge-base/CONTEXT.md 2>/dev/null && echo "KB_OK" || echo "KB_MISSING"

# 检查 CLAUDE.md 是否已配置
grep -q "CONTEXT.md" CLAUDE.md 2>/dev/null && echo "ALREADY_SET" || echo "NOT_SET"
```

**若 KB_MISSING**：
```
❌ app-knowledge-base/CONTEXT.md 不存在。
请先执行「梳理知识库」（入口1）生成应用知识库，
知识库生成后会自动包含 CONTEXT.md（L0 层）。
```

**若 ALREADY_SET**：
```
✅ CLAUDE.md 已包含知识库引用，无需重复配置。
```

---

## 配置步骤

```bash
# 若 CLAUDE.md 不存在，创建空文件
[ -f "CLAUDE.md" ] || touch CLAUDE.md

# 将 @app-knowledge-base/CONTEXT.md 写入首行
```

在 `CLAUDE.md` **首行**插入（若不存在该行）：
```
@app-knowledge-base/CONTEXT.md
```

---

## 完成输出

```
✅ CLAUDE.md 知识库上下文已配置

CLAUDE.md 首行：@app-knowledge-base/CONTEXT.md
每次会话将自动加载：app-knowledge-base/CONTEXT.md（≤200行，L0 层）

下次启动 Claude Code 即生效，无需其他操作。
```

---

## 多知识库场景

若工程有多个知识库，可在 CLAUDE.md 中追加多行：
```
@app-knowledge-base/CONTEXT.md
@other-service/app-knowledge-base/CONTEXT.md
```
