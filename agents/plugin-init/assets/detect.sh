#!/bin/bash
# Step 2 — 检测各层插件状态

# L0 ECC Runtime
if grep -q '"everything-claude-code@everything-claude-code".*true' "$HOME/.claude/settings.json" 2>/dev/null; then
  ecc_installed=true
  ecc_skills_dir="$HOME/.claude/skills"
else
  ecc_installed=false
  ecc_skills_dir=""
fi

# L0 ECC Rules
if find "$HOME/.claude/rules/" -name "*.md" 2>/dev/null | grep -q "."; then
  ecc_rules_installed=true
  ecc_rules_claude_md="$HOME/.claude/CLAUDE.md"
else
  ecc_rules_installed=false
  ecc_rules_claude_md=""
fi

# L1 RTK
if which rtk >/dev/null 2>&1; then
  rtk_installed=true
else
  rtk_installed=false
fi

# L2 GitNexus
if command -v gitnexus >/dev/null 2>&1; then
  gn_cli_installed=true
  gn_version=$(gitnexus --version 2>/dev/null | head -1 | awk '{print $3}' || echo "unknown")
else
  gn_cli_installed=false
  gn_version=""
fi
if grep -q '"gitnexus"' "$PWD/.claude/settings.json" 2>/dev/null; then
  gn_mcp_configured=true
else
  gn_mcp_configured=false
fi
if [ -d "$PWD/.gitnexus/" ]; then
  gn_indexed=true
  gn_nodes=$(find "$PWD/.gitnexus" -name "*.json" -exec cat {} \; 2>/dev/null | grep -o '"nodes"' | wc -l | tr -d ' ' || echo "0")
  gn_edges=$(find "$PWD/.gitnexus" -name "*.json" -exec cat {} \; 2>/dev/null | grep -o '"edges"' | wc -l | tr -d ' ' || echo "0")
else
  gn_indexed=false
  gn_nodes="0"
  gn_edges="0"
fi

# L3 autoresearch
if grep -q '"autoresearch@autoresearch".*true' "$HOME/.claude/settings.json" 2>/dev/null \
  || { [ -f "$HOME/.claude/commands/autoresearch.md" ] && [ -d "$HOME/.claude/skills/autoresearch" ]; }; then
  ar_installed=true
  ar_skills_dir="$HOME/.claude/skills/autoresearch"
else
  ar_installed=false
  ar_skills_dir=""
fi

# L4 PUA
if [ -f "$HOME/.claude/skills/pua/SKILL.md" ]; then
  pua_installed=true
  pua_flavor=$(grep -oP '(?<=flavor:\s)[a-z]+' "$HOME/.claude/skills/pua/SKILL.md" 2>/dev/null || echo "default")
else
  pua_installed=false
  pua_flavor=""
fi

# L5 Beads
if which bd >/dev/null 2>&1; then
  beads_installed=true
  beads_version=$(bd --version 2>/dev/null | head -1 | awk '{print $3}' || echo "unknown")
else
  beads_installed=false
  beads_version=""
fi
if [ -d "$PWD/.beads/" ]; then
  beads_initialized=true
  beads_issue_count=$(bd list 2>/dev/null | grep -c '─' || echo "0")
else
  beads_initialized=false
  beads_issue_count="0"
fi
if grep -q "Use 'bd' for task tracking" "$PWD/CLAUDE.md" 2>/dev/null; then
  beads_claude_integrated=true
else
  beads_claude_integrated=false
fi
