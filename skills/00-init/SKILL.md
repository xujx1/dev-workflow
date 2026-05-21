---
name: 00-init
version: v2.1.0
description: dev-workflow 初始化 Skill。包含三个子流程：project-init（必做，项目环境初始化）、plugin-init（推荐，插件安装，默认含 OpenSpec 深度集成 + 业务工程 openspec init）、beads_init（推荐，Beads 任务追踪初始化）。当用户说"初始化"、"00-init"、"安装插件"、"配置环境"、"project-init"、"plugin-init"、"beads_init"时触发。
user-invocable: true
---

# 00-init — 初始化编排

> 本 Skill 包含三个独立 Agent，可单独触发，也可组合执行。

## 子流程说明

| Agent | 调用指令 | 职责 | 是否必做 |
|-------|---------|------|---------|
| `project-init` | `/dev-workflow:project-init` | 检测 Java/Maven 环境 + 测试依赖，写入 `env` 字段 | **必做**，后续 Skill 依赖 `env_confirmed=true` |
| `plugin-init` | `/dev-workflow:00-init --plugin` | 检测并安装 ECC/RTK/GitNexus/autoresearch/PUA/OpenSpec/Beads，写入 `plugin_availability`；**默认包含 GitNexus 安装（含 MCP 配置 + `npx gitnexus analyze` 索引创建）+ autoresearch 安装（知识库构建必需）+ OpenSpec 安装 + 在业务工程目录执行 `openspec init`；Beads 默认安装并执行 `bd init` + `bd setup claude`** | **推荐**，GitNexus + autoresearch 为知识库构建默认依赖，OpenSpec 为核心工作流引擎，Beads 为默认任务追踪，均默认安装 |
| `beads_init` | `/dev-workflow:00-init --beads` | 单独初始化 Beads 任务追踪（`bd init` + `bd setup claude`），写入 CLAUDE.md 集成指令；**已内嵌到 plugin-init 默认流程，通常无需单独执行** | **可选**，plugin-init 已默认包含 |

Agent 定义路径：
- `agents/project-init/project-init-agent.md`
- `agents/plugin-init/plugin-init-agent.md`

---

## 执行策略

### 用户说"初始化" / "00-init"（默认）

询问用户：
```
您希望执行哪个初始化步骤？
A. project-init — 项目环境检测（必做，首次使用必须执行）
B. plugin-init  — 插件安装（推荐，默认包含 OpenSpec 安装 + 业务工程目录初始化）
C. beads_init   — Beads 任务追踪初始化（推荐，提供跨会话上下文恢复）
D. 全部执行（推荐新环境）
```

根据用户选择调用对应 Agent。

> **注意**：选 B 或 D 时，plugin-init Agent 将在**用户当前工作的业务工程目录**（非 dev-workflow 目录）执行 `openspec init`，需确保工作目录已 `cd` 到业务工程根目录（如 `your-app-name/`）。

### 用户说"project-init" / "初始化项目环境"

直接调用 `project-init` Agent。

### 用户说"plugin-init" / "安装插件" / `--plugin` 参数

直接调用 `plugin-init` Agent。

### 用户说"beads_init" / "初始化任务追踪" / `--beads` 参数

执行 Beads 初始化流程（内联执行，无需独立 Agent）：

```
Step 1: 检测 bd CLI
  - which bd → 存在 → 继续
  - 不存在 → 提示安装：
    curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash

Step 2: 初始化 Beads 数据库
  - bd init（在项目根目录生成 .beads/ 数据库）

Step 3: 配置 Claude Code 集成
  - $BD_BIN setup claude（全局安装钩子，推荐）
  - 或 $BD_BIN setup claude --project（仅当前项目）

Step 4: 验证集成
  - $BD_BIN setup claude --check（检查钩子是否生效）
  - $BD_BIN prime（手动输出任务上下文，验证可用）

Step 5: 确保 CLAUDE.md 包含 Beads 指令
  - 检查项目 CLAUDE.md 是否包含 "Use '$BD_BIN' for task tracking"
  - 不包含 → 追加

Step 6: 写入 plugin_availability
  - 将 beads.installed=true 写入 .mrd-to-code-config.json
```

---

## 下游 Skill 依赖规则

| 字段缺失 | 处理策略 |
|---------|---------|
| `env.java.detected=false` | **阻塞**：提示先运行 `/dev-workflow:project-init` |
| `plugin_availability` 缺失 | **降级**：所有插件能力标记 `unavailable`，不阻塞主流程 |
| `plugin_availability.openspec.initialized=false` | **警告**：提示在业务工程目录运行 `openspec init .`，不阻塞主流程 |
| `plugin_availability.beads.installed=false` | **降级**：任务追踪回退到 TodoWrite，不阻塞主流程 |

---

## 配置文件输出结构

`.mrd-to-code-config.json` 由 `project-init` 和 `plugin-init` agent 共同写入。

完整字段说明见：
- **env / test_runtime / openspec** → [`agents/project-init/project-init-agent.md**](../../agents/project-init/project-init-agent.md) "配置文件输出结构"章节
- **plugin_availability** → [`agents/plugin-init/plugin-init-agent.md**](../../agents/plugin-init/plugin-init-agent.md) "配置文件输出结构"章节
- **model_routing** → 模型路由配置，详见 [`problem-10-model-routing.md**](../../usage-feedback%20/0521/tech-designs/problem-10-model-routing.md)

## 模型路由说明

### 配置说明

在 `.mrd-to-code-config.json` 中新增 `model_routing` 节，支持按能力类别路由到不同模型：

- **enabled**: 是否启用模型路由（默认 false，单模型模式）
- **baseline_model**: 单模型模式下使用的模型
- **category_models**: 各类别模型列表（deep/quick/writing/default）
- **stage_overrides**: 特定 Stage 的类别覆盖
- **risk_escalation**: 风险驱动的自动升级配置

### 使用模型解析

使用 `.workflow/scripts/model-resolver.js 解析模型：

```bash
# 解析 Stage 02-tech-design 的模型
node .workflow/scripts/model-resolver.js resolve 02-tech-design

# 检查是否为单模型模式
node .workflow/scripts/model-resolver.js check-baseline

# 显示单模型提醒（关键 Stage）
node .workflow/scripts/model-resolver.js show-reminder 02-tech-design

# 记录模型使用
node .workflow/scripts/model-resolver.js log 02-tech-design claude-opus-4 deep
```

### 单模型兼容

当 `model_routing.enabled=false` 或未配置时，自动退化为单模型模式，流程不中断。

---

## 三层配置加载机制

dev-workflow 支持**组织级（org）→ 项目集级（workspace）→ 项目级（project）**三层配置继承。

### 层级定义

| 层级 | 路径 | 职责 | 维护方 |
|------|------|------|--------|
| org | `~/.config/mrd-to-code/org-config.json` 或 `{org-repo}/.mrd-to-code-org.json` | 全组织共享的规范（代码风格、安全检查规则、禁用的 LLM 模型） | 基础设施团队 |
| workspace | `{monorepo-root}/.mrd-to-code-workspace.json` | 同一 monorepo 内共享的配置（公共依赖版本、共享知识库路径） | 技术负责人 |
| project | `{project-dir}/.mrd-to-code-config.json` | 单项目专属配置（tech_stack、test_framework、openspec 阈值） | 各项目开发者 |

### 配置合并规则

```
合并优先级: project > workspace > org

规则:
1. project 中未声明的字段，从 workspace 继承。
2. workspace 中未声明的字段，从 org 继承。
3. project 可通过 "override": true 显式声明覆盖，提高可读性。
4. org 中标记为 "locked": true 的字段，不允许被低层覆盖。
```

### 配置加载脚本

运行以下命令解析并合并三层配置：

```bash
node .workflow/scripts/config-resolver.js
```

合并后的配置写入 `.workflow/resolved-config.json`，包含 `__meta.source_tracking` 字段记录每个配置值的来源层级。

### 按层级升级配置

使用 `mrd-upgrade` 命令按层级更新配置：

```bash
# 只升级组织级配置（统一推送）
node .workflow/scripts/mrd-upgrade.js --layer org --version 2.0

# 升级项目集级配置
node .workflow/scripts/mrd-upgrade.js --layer workspace

# 升级项目级（需人工确认，避免覆盖自定义）
node .workflow/scripts/mrd-upgrade.js --layer project --interactive

# 升级所有层级
node .workflow/scripts/mrd-upgrade.js --all
```

升级时按层级分别处理，低层配置不受影响。

### 模板文件

- `skills/00-init/assets/org-config-template.json` — org 层配置模板
- `skills/00-init/assets/workspace-config-template.json` — workspace 层配置模板
- `skills/00-init/assets/config-template.json` — project 层配置模板（含 `layer: "project"` 字段）

