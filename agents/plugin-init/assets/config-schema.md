# plugin-init 配置文件输出结构

`plugin-init` 写入 `.mrd-to-code-config.json` 的 `plugin_availability` 字段：

```json
{
  "plugin_availability": {
    "ecc_runtime": {
      "installed": true,
      "skills_dir": "~/.claude/skills",
      "version": "unknown"
    },
    "ecc_rules": {
      "installed": true,
      "claude_md": "~/.claude/CLAUDE.md"
    },
    "hooks": {
      "installed": true,
      "gitnexus_hook": "~/.claude/hooks/gitnexus/gitnexus-hook.cjs",
      "hooks_json": "~/.claude/hooks/hooks.json"
    },
    "rtk": {
      "installed": true,
      "config": "RTK.md referenced in CLAUDE.md"
    },
    "gitnexus": {
      "installed": true,
      "version": "1.6.2",
      "mcp_configured": true,
      "mcp_available": true,
      "indexed_at": "2026-04-27T14:37:00+08:00",
      "index_path": "/path/to/your-app/.gitnexus"
    },
    "autoresearch": {
      "installed": true,
      "skills_dir": "~/.claude/skills/autoresearch"
    },
    "pua": {
      "installed": true,
      "active": true,
      "flavor": "alibaba"
    },
    "openspec": {
      "installed": true,
      "version": "1.0.0",
      "cli_path": "/usr/local/bin/openspec",
      "schema": "java-tdd",
      "initialized": true,
      "project_path": "/path/to/your-app",
      "skills_generated": true
    },
    "beads": {
      "installed": true,
      "version": "1.0.3",
      "path": "/Users/admin/.local/bin/bd",
      "initialized": true,
      "backend": "dolt",
      "mode": "embedded",
      "database": "your_project_db_name",
      "issue_prefix": "your-project-name"
    }
  },
  "last_updated": "2026-04-27T15:00:00+08:00"
}
```
