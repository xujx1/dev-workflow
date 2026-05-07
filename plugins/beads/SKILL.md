---
name: beads-plugin
version: v1.0.0
description: |
  Beads 任务追踪插件。提供 BD_BIN 变量解析、安装验证、issue 生命周期管理。
  所有 Skill/Agent 中 `bd` 调用统一走 `$BD_BIN`，解决非交互式 shell PATH 缺失问题。
  当用户说"安装Beads"、"验证Beads"、"bd不可用"时触发。
type: plugin
trigger: always-on
---

# Beads 任务追踪插件

## 定位

Beads 是 dev-workflow 的**任务追踪层**，替代 TodoWrite/TaskCreate/markdown TODO，提供：

- 硬阻塞门禁（`$BD_BIN ready` / `$BD_BIN blocked`）
- Dolt 版本化状态回滚（`$BD_BIN dolt reset`）
- 跨 session 持久记忆（`$BD_BIN remember`）
- Phase 依赖声明与自动推进

---

## Binary Resolution（P0 — `bd: command not found` 防御）

Claude Code 的非交互式 shell 不加载 `~/.zshrc`，导致 `bd` 可能不在 PATH 中。
**所有 `bd` 调用前必须执行一次**：

```bash
export BD_BIN="${BD_BIN:-$(command -v bd 2>/dev/null || echo "$HOME/.local/bin/bd")}"
if ! command -v "$BD_BIN" >/dev/null 2>&1; then echo "BD_NOT_FOUND"; fi
```

后续所有 Skill/Agent 中 `bd` 命令统一写为 `$BD_BIN`（如 `$BD_BIN create`、`$BD_BIN update`、`$BD_BIN ready`）。
**禁止裸写 `bd`**，除非在纯文档说明中（非执行上下文）。

---

## 前置检查

```bash
export BD_BIN="${BD_BIN:-$(command -v bd 2>/dev/null || echo "$HOME/.local/bin/bd")}"
if ! command -v "$BD_BIN" >/dev/null 2>&1; then
  echo "BD_NOT_FOUND"
else
  $BD_BIN --version
  echo "BD_OK"
fi
```

**若 BD_NOT_FOUND**：
```
❌ Beads 未安装。

安装方式：
  brew install beads
  # 或
  curl -fsSL https://get.beads.dev | sh

安装完成后重新说"安装Beads"，或手动执行：
  bd init
```

---

## 安装步骤

```bash
# 1. 初始化项目数据库
$BD_BIN init

# 2. 安装 Claude Code 钩子（推荐全局）
$BD_BIN setup claude
# 或仅当前项目：
# $BD_BIN setup claude --project

# 3. 验证集成
$BD_BIN setup claude --check
$BD_BIN prime
```

**成功输出示例**：
```
✅ Beads 任务追踪已启用

版本：bd X.Y.Z
数据库：.beads/*.db
钩子：claude-code (全局)
阻塞模式：数据层硬阻塞

📌 需重启 Claude Code 使钩子生效
```

---

## Quick Reference

```bash
$BD_BIN ready              # 查询可执行任务（unblocked）
$BD_BIN show <id>          # 查看 issue 详情
$BD_BIN create "标题" --type task  # 创建任务
$BD_BIN update <id> --claim       # 认领任务
$BD_BIN update <id> --status done # 标记完成
$BD_BIN update <id> --status blocked  # 标记阻塞
$BD_BIN close <id>         # 关闭 issue
$BD_BIN dep add <down> <up> --type blocks  # 声明阻塞依赖
$BD_BIN dolt push          # 同步到远程
$BD_BIN prime              # 输出完整工作上下文
$BD_BIN remember           # 持久记忆管理
```

---

## 与 Skill 集成模式

### 知识库 Skill（01-knowledge-base）

```bash
$BD_BIN create "应用知识库生成" --type task
$BD_BIN create "业务知识库生成" --type task
$BD_BIN create "测试知识库生成" --type task
```

状态：启动→`$BD_BIN update <id> --status in_progress`，完成→`--status done`，失败→`--status blocked`。

### 实施方案 Skill（02-implementation-plan）

```bash
$BD_BIN create "PRD 生成" --type task
$BD_BIN create "技术方案生成" --type task
$BD_BIN dep add <tech-design-id> <prd-id> --type blocks
```

### 代码生成 Skill（03-code-gen-tdd）

```bash
$BD_BIN create "Phase N: <名称>" --type task   # 每个 Phase
$BD_BIN dep add <phase-N+1-id> <phase-N-id> --type blocks
```

Phase 门禁：启动前 `$BD_BIN ready`，完成后 `$BD_BIN update <id> --status done`。

### 归档 Skill（04-archive）

```bash
$BD_BIN list --status open
$BD_BIN close <issue-id>   # 对每个 open issue
```

---

## 降级策略

Beads 不可用时（`BD_NOT_FOUND`），回退到 `execution-state.md` 派发清单 + Phase 门禁字段（`phase_gate_status` / `awaiting_user_confirmation_for`），LLM 自觉遵守 Phase 顺序。不影响主流程。

---

## 配置项（`.mrd-to-code-config.json`）

```json
{
  "plugin_availability": {
    "beads": {
      "installed": true,
      "version": "1.0.3"
    }
  }
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `beads.installed` | boolean | `false` | 是否已安装 |
| `beads.version` | string | `""` | 安装版本号 |

---

## 验证命令

```bash
$BD_BIN --version        # 确认版本
$BD_BIN list --status open  # 查看当前 open issue
$BD_BIN ready            # 查询可执行任务
$BD_BIN prime            # 完整工作上下文
```
