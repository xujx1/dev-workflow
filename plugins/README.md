# 插件分层矩阵（SSOT）

> 本文件是 dev-workflow 插件的权威说明。`README.md`、`docs/quickstart.md`、`plugins/project-setup/SKILL.md` 的插件描述均以本文件为准。

---

## 分层矩阵

## 平台口径

- `Cursor 有明确安装命令`：`GitNexus`、`autoresearch`
- `跨环境通用命令`：`ECC Rules`、`RTK`
- `Claude Code only`：`everything-claude-code`、`anthropics/claude-code`、`anthropics/skills`、`VoltAgent`

| 层级 | 类别 | 插件 | 来源 | 是否阻塞主流程 | 自动触发场景 | 默认自动安装动作 | 手动兜底命令 |
|------|------|------|------|--------------|------------|------------------|--------------|
| **L0** | 基础层 | `everything-claude-code` (ECC) | 官方基础市场 | ✅ 阻塞 | 任意阶段入口 | `Claude Code only: /plugin marketplace add https://github.com/affaan-m/everything-claude-code` | 同左 |
| **L0** | 基础层 | ECC Rules | ECC 仓库 | ❌ 不阻塞 | ECC 已装时子检测 | `git clone https://github.com/affaan-m/everything-claude-code.git && cp -r everything-claude-code/rules/* ~/.claude/rules/` | 同左 |
| **L0** | 基础层 | `anthropics/claude-code` | 官方基础市场 | ❌ 不阻塞 | 首次提示一次 | `-` | `Claude Code only: /plugin marketplace add anthropics/claude-code` |
| **L1** | Token 优化层 | `RTK` | Homebrew | ✅ 阻塞（透明工具，必装） | git/rg/ls 输出自动压缩，用户无感 | `brew install rtk && rtk init --global` | 同左 |
| **L1** | 任务追踪层 | `Beads`（bd） | Homebrew / curl | ✅ 阻塞（必装，用户无感） | 所有 Skill Phase 门禁 + issue 生命周期 + 跨 session 记忆 | `brew install beads && bd init && bd setup claude` | 见 `plugins/beads/SKILL.md` |
| **L2** | 结构分析层 | `GitNexus`（实时调用链 / 影响面） | MCP | ✅ 阻塞（必装，用户无感） | Phase 3 Code Review / tech-design 影响面分析，MCP 自动调用 | `Claude Code：/plugin marketplace add ... && /plugin install ...；Cursor：npm install -g gitnexus && 写入 {project_root}/.claude/settings.json && gitnexus analyze .` | 见 `plugins/gitnexus/SKILL.md` |
| **L3** | 推理增强层 | `autoresearch` | 可选增强市场 | ✅ 阻塞（必装，用户无感） | Phase 2 场景扩展 / Phase 3 多视角 / Phase 5 调试，后台自动增强 | `Claude Code：/plugin marketplace add https://github.com/uditgoenka/autoresearch && /plugin install autoresearch@autoresearch；Cursor：clone uditgoenka/autoresearch 并复制 claude-plugin/ 到 ~/.claude` | 见 `plugins/autoresearch/SKILL.md` |
| **L4** | 文档处理层 | `anthropics/skills` | 官方基础市场 | ❌ 不阻塞 | MRD 为 PDF/PPTX/XLSX 时 | `-` | `Claude Code only: /plugin marketplace add anthropics/skills` |
| **L5** | 专家子代理层 | `VoltAgent` | 可选增强市场 | ❌ 不阻塞 | code-gen-tdd Phase 3 Code Review | `-` | `Claude Code only: /plugin marketplace add VoltAgent/awesome-claude-code-subagents` |

---

## 市场来源说明

- **官方基础市场**：`anthropics/claude-code`、`anthropics/skills`（Anthropic 官方维护，稳定可信，推荐所有用户安装）
- **第三方增强市场**：`affaan-m/everything-claude-code`、`uditgoenka/autoresearch`、`VoltAgent/...`（第三方高效市场，含必装与可选项）
- **dev-workflow 内置**：`plugins/rtk`、`plugins/beads`（随本插件分发，无需外部市场）

---

## 推荐安装顺序

```text
L0 → L1 → L2 → L3 → L4/L5（可选）
```

1. **L0 必装**：`/plugin marketplace add https://github.com/affaan-m/everything-claude-code`
2. **L0 补 Rules**：`git clone ... && cp -r everything-claude-code/rules/* ~/.claude/rules/`
3. **L1 必装**：`brew install rtk && rtk init --global`
4. **L1 必装**：`brew install beads && bd init && bd setup claude`
5. **L2 必装**：Claude Code 走 `/plugin marketplace add https://github.com/abhigyanpatwari/GitNexus && /plugin install gitnexus@gitnexus-marketplace`；Cursor 走 `npm install -g gitnexus` + 写入 `{project_root}/.claude/settings.json` + `gitnexus analyze .`
6. **L3 必装**：Claude Code 走 `/plugin marketplace add https://github.com/uditgoenka/autoresearch && /plugin install autoresearch@autoresearch`；Cursor 走 `git clone https://github.com/uditgoenka/autoresearch.git` 并复制 `claude-plugin/` 到 `~/.claude`
7. **L4/L5 按需**：anthropics/skills、VoltAgent

---

## 运行时路由原则

- 插件安装统一由 `/dev-workflow:00-init` skill 执行，检测并安装后写入 `.mrd-to-code-config.json` 标志位
- 已装则自动生效；未装时运行 `/dev-workflow:00-init` 进行安装
- 阻塞规则：`l0_ecc=unavailable`(任意阶段)/`l1_rtk=unavailable`(任意阶段)/`l1_beads=unavailable`(任意阶段)/`l2_gitnexus!=available`(任意阶段)/`l3_autoresearch=unavailable`(任意阶段)
- GitNexus 调用链查询由 `java-review-agent`（Phase 3）和 `tech-design-agent` 按需**自动**发起 MCP 调用，用户无感
- autoresearch 由各阶段 Skill 检测到 `l3_autoresearch=available` 后**自动**在后台增强，用户无感

---

## 业务工程专属配置

| 配置项 | 触发词 | 说明 |
|--------|--------|------|
| `plugins/claude-md/` | "配置CLAUDE.md" | 将 `app-knowledge-base/00_概览.md` 写入 CLAUDE.md 首行 |
