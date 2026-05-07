#!/bin/bash
# Step 6 — Beads 任务追踪初始化（默认安装）
# bd 未安装时自动安装，安装后执行 bd init + bd setup claude。

# BD_BIN 别名处理（Claude Code 非交互式 shell 不加载 ~/.zshrc）
export BD_BIN="${BD_BIN:-$(command -v bd 2>/dev/null || echo "$HOME/.local/bin/bd")}"

# 若 bd 未安装，自动安装
if ! command -v "$BD_BIN" >/dev/null 2>&1; then
  echo "Beads CLI 未安装，正在安装..."
  curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
  export BD_BIN="$HOME/.local/bin/bd"
fi

if command -v "$BD_BIN" >/dev/null 2>&1; then
  # 初始化 Beads 数据库（含 dolt 损坏自动修复）
  if [ ! -d ".beads/" ]; then
    if ! "$BD_BIN" init 2>&1; then
      # dolt 损坏修复
      BEADS_DOLT_DIR=".beads/embeddeddolt"
      if [ -d "$BEADS_DOLT_DIR" ]; then
        echo "🔧 检测到损坏的 Beads dolt 数据，清空后重试..."
        find "$BEADS_DOLT_DIR" -type f -delete 2>/dev/null
        find "$BEADS_DOLT_DIR" -type d -empty -delete 2>/dev/null
        "$BD_BIN" init 2>&1 && echo "✅ Beads 重新初始化成功（dolt 已修复）" || echo "❌ Beads 初始化失败，请手动执行: $BD_BIN init"
      fi
    else
      echo "✅ Beads 数据库已初始化"
    fi
  else
    echo "Beads 数据库已存在，跳过初始化"
  fi

  # 配置 Claude Code 集成（若未配置）
  if ! grep -q "Use '\$BD_BIN' for task tracking" CLAUDE.md 2>/dev/null; then
    "$BD_BIN" setup claude 2>/dev/null || true
    echo "✅ Beads Claude Code 集成已配置"
  else
    echo "Beads Claude Code 集成已存在"
  fi

  # 验证
  "$BD_BIN" setup claude --check 2>/dev/null || true
  beads_status="initialized"
else
  echo "❌ Beads 安装失败，请手动执行: curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash"
  beads_status="install_failed"
fi
