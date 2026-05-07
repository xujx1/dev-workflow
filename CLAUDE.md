# dev-workflow 编码行为规范

## 代码修改原则

- 每次代码修改只改任务直接相关的代码，不顺手优化无关部分（不删预存死代码、不改无关命名、不重构无关逻辑）
- 优先用最少代码量解决问题；有引入新抽象层或设计模式的需求时，必须先说明引入理由，再执行


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Binary Resolution (P0 — `bd: command not found` 防御)

Claude Code 的非交互式 shell 不加载 `~/.zshrc`，导致 `bd` 可能不在 PATH 中。
**所有 `bd` 调用前必须执行一次**：

```bash
export BD_BIN="${BD_BIN:-$(command -v bd 2>/dev/null || echo "$HOME/.local/bin/bd")}"
if ! command -v "$BD_BIN" >/dev/null 2>&1; then echo "BD_NOT_FOUND"; fi
```

后续所有 Skill/Agent 中 `bd` 命令统一写为 `$BD_BIN`（如 `$BD_BIN create`、`$BD_BIN update`、`$BD_BIN ready`）。
**禁止裸写 `bd`**，除非在纯文档说明中（非执行上下文）。

### Quick Reference

```bash
$BD_BIN ready              # Find available work
$BD_BIN show <id>          # View issue details
$BD_BIN update <id> --claim  # Claim work
$BD_BIN close <id>         # Complete work
```

### Rules

- Use `$BD_BIN` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `$BD_BIN prime` for detailed command reference and session close protocol
- Use `$BD_BIN remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   $BD_BIN dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **dev-workflow** (4293 symbols, 4390 relationships, 9 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/dev-workflow/context` | Codebase overview, check index freshness |
| `gitnexus://repo/dev-workflow/clusters` | All functional areas |
| `gitnexus://repo/dev-workflow/processes` | All execution flows |
| `gitnexus://repo/dev-workflow/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
