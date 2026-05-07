#!/bin/bash
# Step 3.5 — dev-workflow assets/ 完整性校验
# 仅在 ECC 已安装（l0_ecc=available）时执行；check 模式跳过。

PLUGIN_BASE="$HOME/.claude/plugins/dev-workflow"
AGENTS_BASE="$HOME/.claude/agents"
repaired=0

if [ -d "$PLUGIN_BASE/agents" ]; then
  for agent_dir in "$PLUGIN_BASE/agents"/*/; do
    agent_name=$(basename "$agent_dir")
    src_assets="$PLUGIN_BASE/agents/$agent_name/assets"
    dst_assets="$AGENTS_BASE/$agent_name/assets"
    if [ -d "$src_assets" ] && [ ! -d "$dst_assets" ]; then
      cp -r "$src_assets" "$AGENTS_BASE/$agent_name/"
      echo "repaired: $agent_name/assets"
      repaired=$((repaired + 1))
    fi
  done
fi

[ "$repaired" -eq 0 ] && echo "assets/ 完整性校验通过" || echo "已自动补齐 $repaired 个 assets/ 目录"
