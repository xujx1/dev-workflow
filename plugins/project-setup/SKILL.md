---
name: project-setup
version: v4.1.0
description:  AI 辅助研发环境初始化向导。展示插件分层矩阵，区分"官方基础市场"和"可选增强市场"，自动检测未安装项并优先自动安装阻塞层，失败时回退到明确手动命令。当用户说"初始化AI Coding环境"、"安装AI开发环境"、"setup ai coding"时触发。
user-invocable: true
---

#  AI Coding 环境初始化

> 本插件是**环境安装向导总入口**，检测未安装项并引导选择安装。

---

## 插件分层矩阵

> 平台口径：
> - `Cursor 有明确安装命令`：`GitNexus`、`autoresearch`
> - `Claude Code only`：`everything-claude-code`、`anthropics/claude-code`、`anthropics/skills`、`VoltAgent`

| 层级 | 类别 | 插件 | 来源 | 是否阻塞主流程 | 默认自动安装动作 | 手动兜底命令 |
|------|------|------|------|--------------|------------------|--------------|
| **L0** | 基础层 | `everything-claude-code` (ECC) | 官方基础市场 | ✅ 阻塞 | `Claude Code only: /plugin marketplace add https://github.com/affaan-m/everything-claude-code` | 同左 |
| **L0** | 基础层 | `anthropics/claude-code`（PR Review / commit 规范） | 官方基础市场 | ❌ 不阻塞 | `-` | `Claude Code only: /plugin marketplace add anthropics/claude-code` |
| **L1** | 质量门层 | `plugins/hooks`（execution-state / commit 管控） | dev-workflow | ❌ 不阻塞 | `-` | `dev-workflow:hooks-setup
| **L2** | Token 优化层 | `RTK`（压缩 git/rg/ls 输出，用户无感） | Homebrew | ✅ 阻塞（必装） | `brew install rtk && rtk init --global` | 同左 |
| **L3** | 结构分析层 | `GitNexus`（实时调用链 / 影响面）| MCP | ✅ 阻塞（必装，无感） | `Claude Code: marketplace/install；Cursor: npm/npx + 写入 .claude/settings.json + analyze` | 见 `plugins/gitnexus/SKILL.md` |
| **L4** | 推理增强层 | `autoresearch`（场景扩展/多视角/调试闭环） | 可选增强市场 | ✅ 阻塞（必装，无感） | `Claude Code: /plugin ...；Cursor: clone repo + copy claude-plugin files` | 见 `plugins/autoresearch/SKILL.md` |
| **L5** | 文档处理层 | `anthropics/skills`（PDF/PPTX/XLSX 解析） | 官方基础市场 | ❌ 不阻塞 | `-` | `Claude Code only: /plugin marketplace add anthropics/skills` |
| **L6** | 专家子代理层 | `VoltAgent`（安全 Review / 细分质量代理） | 可选增强市场 | ❌ 不阻塞 | `-` | `Claude Code only: /plugin marketplace add VoltAgent/awesome-claude-code-subagents` |

> **官方基础市场**：`anthropics/claude-code`、`anthropics/skills`（Anthropic 官方维护，稳定可信）
> **第三方增强市场**：`affaan-m/everything-claude-code`、`uditgoenka/autoresearch`、`VoltAgent/...`（第三方高效市场，含必装与可选项）
> **dev-workflow 内置**：`plugins/hooks`、`plugins/rtk`（随本插件分发，无需外部市场）

---

## 独立插件（可单独触发）

| 插件 | 触发词 | 说明 |
|------|--------|------|
| `plugins/rtk/` | "安装RTK"、"Token压缩" | RTK Token 压缩，节省 57-78% |

| `plugins/autoresearch/` | "安装autoresearch" | 推理增强（`/plugin marketplace add https://github.com/uditgoenka/autoresearch`）|
| `plugins/claude-md/` | "配置CLAUDE.md"、"知识库上下文" | 知识库上下文自动加载 |
| `plugins/hooks/` | "安装hooks"、"自动化hooks" | 质量门 / 状态持久化 |

---

## 一键初始化流程

### Step 0：首次运行检测

```bash
[ -f ".claude/ai-coding.json" ] && echo "SETUP_DONE" || echo "FIRST_RUN"
```

- **SETUP_DONE** → 自动触发场景下跳过向导；手动触发则继续检测以补装新增插件
- **FIRST_RUN** → 展示安装向导

### Step 1：环境探测（按分层矩阵）

```bash
# L0
grep -q '"everything-claude-code@everything-claude-code"[[:space:]]*:[[:space:]]*true' \
  "$HOME/.claude/settings.json" 2>/dev/null && echo "ECC_OK" || echo "ECC_MISSING"
ls "$HOME/.claude/rules/" 2>/dev/null | grep -q "." && echo "ECC_RULES_OK" || echo "ECC_RULES_MISSING"
ls "$HOME/.claude/plugins/" 2>/dev/null | grep -qi "anthropics" && echo "ANTHROPICS_OK" || echo "ANTHROPICS_MISSING"

# L1
grep -q "session:start\|post:read:kb-hit-tracker" "$PWD/.claude/settings.json" 2>/dev/null \
  && echo "HOOKS_OK" || echo "HOOKS_MISSING"

# L2
which rtk >/dev/null 2>&1 && echo "RTK_OK" || echo "RTK_MISSING"

# L3 GitNexus
if command -v gitnexus >/dev/null 2>&1 || npx -y gitnexus@latest --version >/dev/null 2>&1; then
  echo "GITNEXUS_CLI_OK"
else
  echo "GITNEXUS_CLI_MISSING"
fi
grep -q '"gitnexus"' "$PWD/.claude/settings.json" 2>/dev/null \
  && echo "GITNEXUS_MCP_OK" || echo "GITNEXUS_MCP_MISSING"
[ -d ".gitnexus/" ] && echo "GITNEXUS_INDEXED" || echo "GITNEXUS_NOT_INDEXED"

# L4
if grep -q '"autoresearch@autoresearch"[[:space:]]*:[[:space:]]*true' "$HOME/.claude/settings.json" 2>/dev/null \
  || { [ -f "$HOME/.claude/commands/autoresearch.md" ] && [ -d "$HOME/.claude/skills/autoresearch" ]; }; then
  echo "AUTORESEARCH_OK"
else
  echo "AUTORESEARCH_MISSING"
fi

# L5
ls "$HOME/.claude/plugins/" 2>/dev/null | grep -qi "document-skills" \
  && echo "DOCSKILLS_OK" || echo "DOCSKILLS_MISSING"

# L6
ls "$HOME/.claude/plugins/" 2>/dev/null | grep -qi "voltagent" \
  && echo "VOLTAGENT_OK" || echo "VOLTAGENT_MISSING"

# 业务工程检测
which dcc 2>/dev/null && echo "DCC_OK" || echo "DCC_MISSING"
ls app-knowledge-base/00_概览.md 2>/dev/null && echo "KB_OK" || echo "KB_MISSING"
[ -f "CLAUDE.md" ] && grep -q "00_概览.md" CLAUDE.md && echo "CLAUDE_MD_OK" || echo "CLAUDE_MD_MISSING"
```

展示探测结果：

```
插件分层检测结果：
  [L0] ECC 基础运行时：        [✅ 已安装 / ❌ 未安装]
  [L0] ECC Rules：             [✅ 已配置 / ⚠️ 缺 Rules 文件]
  [L0] anthropics/claude-code：[✅ 已安装 / ℹ️ 可选，未安装]
  [L1] Hooks 质量门：          [✅ 已安装 / ❌ 未安装]
  [L2] RTK Token 压缩：        [✅ 已安装 / ❌ 未安装]
  [L3] GitNexus MCP：          [✅ 已注册 / ❌ 未安装（阻塞）]
  [L3] GitNexus 索引：         [✅ 已建 / ⚠️ MCP 已装未索引（阻塞） / ❌ 未建（阻塞）]
  [L4] autoresearch：          [✅ 已安装 / ❌ 未安装（阻塞）]
  [L5] anthropics/skills：     [✅ 已安装 / ℹ️ 可选，未安装]
  [L6] VoltAgent：             [✅ 已安装 / ℹ️ 可选，未安装]
  业务工程 dcc：               [✅ 已配置 / ❌ 未配置]
  业务工程知识库：             [✅ 已有 / ❌ 未建]
  CLAUDE.md 知识库上下文：     [✅ 已配置 / ❌ 未配置]
```


### Step 2：安装策略选择（按分层矩阵）

已安装项自动跳过，仅展示待安装项。默认顺序：

1. 先汇总所有阻塞缺失项
2. 用户选择 `auto` 时，按阻塞层顺序自动安装
3. 任一自动安装失败，立即输出剩余手动命令并停止
4. 阻塞层通过后，再按需补装非阻塞增强层

待安装项展示建议：

```
官方基础市场（推荐优先安装）：
  ① [L0] ECC 基础运行时 — everything-claude-code（必装）
  ② [L0] ECC Rules — git clone + cp rules
  ③ [L0] anthropics/claude-code — PR Review / commit 规范

dev-workflow 内置：
  ④ [L1] Hooks 质量门 — execution-state / commit 管控
  ⑤ [L2] RTK Token 压缩 — 节省 57-78% token（用户无感，必装）

第三方增强市场：
  ⑥-B [L3] GitNexus 调用链分析 — 实时影响面分析（必装）
  ⑦ [L4] autoresearch — 场景扩展 / 多视角 / 调试闭环（必装）
  ⑧ [L5] anthropics/skills — PDF/PPTX/XLSX 文档解析
  ⑨ [L6] VoltAgent — 细分专项 Review 子代理

业务工程配置：
  ⑩ CLAUDE.md 知识库上下文（需已有 app-knowledge-base）
  ⑪ dcc 模型偏好（需已安装 dcc）
```

### Step 3：按选择调用各插件/自动安装动作

| 选项 | 执行动作 |
|------|---------|
| ① ECC | 默认自动执行：`Claude Code only: /plugin marketplace add https://github.com/affaan-m/everything-claude-code` |
| ② ECC Rules | 默认自动执行：`git clone https://github.com/affaan-m/everything-claude-code.git && cp -r everything-claude-code/rules/* ~/.claude/rules/` |
| ③ anthropics/claude-code | 提示：`Claude Code only: /plugin marketplace add anthropics/claude-code` |
| ④ Hooks | 执行 `plugins/hooks/SKILL.md` 流程 |
| ⑤ RTK | 执行 `plugins/rtk/SKILL.md` 流程 |
| ⑥-B GitNexus | 默认自动执行：Claude Code 走 marketplace/install；Cursor 走 `npm install -g gitnexus` + 写入项目 `.claude/settings.json` + `gitnexus analyze .` |
| ⑦ autoresearch | 默认自动执行：Claude Code 走 `/plugin marketplace add https://github.com/uditgoenka/autoresearch && /plugin install autoresearch@autoresearch`；Cursor 走 `git clone https://github.com/uditgoenka/autoresearch.git` + copy `claude-plugin/` 到 `~/.claude` |
| ⑧ anthropics/skills | 提示：`Claude Code only: /plugin marketplace add anthropics/skills` |
| ⑨ VoltAgent | 提示：`Claude Code only: /plugin marketplace add VoltAgent/awesome-claude-code-subagents` |
| ⑩ CLAUDE.md | 执行 `plugins/claude-md/SKILL.md` 流程 |
| ⑪ dcc | 执行 `plugins/dcc/SKILL.md` 流程 |

> 对 `/plugin`、`brew`、`pip`、MCP 注册、全局配置写入等动作，需要由 Agent 申请权限/确认；若用户拒绝，则回退到对应手动命令。

### Step 4：完成标记

```bash
echo '{"setup_version": "4.0.0", "setup_date": "'"$(date +%Y-%m-%d)"'"}' > .claude/ai-coding.json
```

```
✅  AI Coding 环境安装完成
下次主流程启动时将跳过此向导。
```
