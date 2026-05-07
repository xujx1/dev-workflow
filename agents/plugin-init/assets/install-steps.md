# Step 3 — 安装各层插件

> 每层最多尝试 1 次；ECC Rules 默认跳过；副作用操作逐项确认。

**L0 ECC**：
```
/plugin marketplace add https://github.com/affaan-m/everything-claude-code
```

**L0 ECC Rules**（仅 full 或 select 确认时）：
```bash
TMP=$(mktemp -d)
git clone --depth 1 https://github.com/affaan-m/everything-claude-code.git $TMP/ecc
mkdir -p ~/.claude/rules && cp -r $TMP/ecc/rules/* ~/.claude/rules/
rm -rf $TMP
```

**L1 RTK**：
```bash
brew install rtk && rtk init --global
```

**L2 GitNexus**：
```
/plugin marketplace add https://github.com/abhigyanpatwari/GitNexus
/plugin install gitnexus@gitnexus-marketplace
```
安装后写入 MCP 配置到 `{project_root}/.claude/settings.json`：
```bash
SETTINGS_FILE="$PWD/.claude/settings.json"
mkdir -p "$PWD/.claude"
if [ ! -f "$SETTINGS_FILE" ]; then
  echo '{}' > "$SETTINGS_FILE"
fi
python3 << 'EOF'
import json, os
settings_path = os.path.join(os.getcwd(), '.claude', 'settings.json')
try:
    settings = json.load(open(settings_path))
except:
    settings = {}
settings.setdefault('mcpServers', {})['gitnexus'] = {
    "command": "npx",
    "args": ["-y", "gitnexus", "mcp"],
    "env": {}
}
json.dump(settings, open(settings_path, 'w'), indent=2, ensure_ascii=False)
print(f"✅ GitNexus MCP 已写入: {settings_path}")
EOF
```

**GitNexus 索引创建**（**安装后默认自动执行，不需要用户确认**）：
```bash
# 确定业务工程目录（优先从配置读取）
BUSINESS_REPO_PATH="$(cat .mrd-to-code-config.json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('env',{}).get('repo_path',''))" 2>/dev/null)"

if [ -n "$BUSINESS_REPO_PATH" ] && [ -d "$BUSINESS_REPO_PATH" ]; then
  # 在业务工程目录创建索引
  (cd "$BUSINESS_REPO_PATH" && npx gitnexus analyze)
  grep -q '\.gitnexus' "$BUSINESS_REPO_PATH/.gitignore" 2>/dev/null || echo '/.gitnexus/' >> "$BUSINESS_REPO_PATH/.gitignore"
  echo "✅ GitNexus 索引已创建: $BUSINESS_REPO_PATH/.gitnexus/"
elif [ -f "pom.xml" ]; then
  # 当前目录是业务工程
  npx gitnexus analyze
  grep -q '\.gitnexus' .gitignore 2>/dev/null || echo '/.gitnexus/' >> .gitignore
  echo "✅ GitNexus 索引已创建: $(pwd)/.gitnexus/"
else
  echo "⚠️  未检测到业务工程路径，请在业务工程根目录手动执行: npx gitnexus analyze"
fi
```

**L3 autoresearch**：
```
/plugin marketplace add https://github.com/uditgoenka/autoresearch
/plugin install autoresearch@autoresearch
```

**L4 PUA**：
```
/plugin marketplace add tanweai/pua
/plugin install pua@pua-skills
```

**L6 OpenSpec**（工作流引擎，深度集成必需，**默认安装**）：
```bash
# 1. 检测 OpenSpec CLI
which openspec || echo "OpenSpec CLI not found"

# 2. 安装（若未安装）
npm install -g openspec

# 3. 确定业务工程目录（从 .mrd-to-code-config.json 读取 repo_path；若未配置则提示用户确认）
# IMPORTANT: openspec init 必须在业务工程根目录执行，而非 dev-workflow 目录
# Agent 应读取 .mrd-to-code-config.json 中的 env.repo_path，或询问用户当前业务工程路径
BUSINESS_REPO_PATH="$(cat .mrd-to-code-config.json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('env',{}).get('repo_path',''))" 2>/dev/null)"
if [ -z "$BUSINESS_REPO_PATH" ]; then
  echo "⚠️  未检测到业务工程路径，请在业务工程根目录手动执行: openspec init . --tools claude"
  SKIP_OPENSPEC_INIT=true
fi

# 4. 在业务工程根目录执行 openspec init（生成 skills + config）
if [ "$SKIP_OPENSPEC_INIT" != "true" ]; then
  (cd "$BUSINESS_REPO_PATH" && openspec init . --tools claude --force)
fi

# 5. 复制 java-tdd 自定义 schema 和模板（从 dev-workflow 资源目录）
# 资源目录：agents/plugin-init/assets/openspec-templates/
if [ "$SKIP_OPENSPEC_INIT" != "true" ]; then
  # 确定 dev-workflow 根目录（向上两级或从 SKILL_ROOT 环境变量）
  SKILL_ROOT="${SKILL_ROOT:-$(cd "$(dirname "$0")/../../.." && pwd)}"
  TEMPLATES_SRC="$SKILL_ROOT/agents/plugin-init/assets/openspec-templates"

  # 复制 java-tdd schema（含 templates 子目录）
  if [ -d "$TEMPLATES_SRC/java-tdd" ]; then
    mkdir -p "$BUSINESS_REPO_PATH/openspec/schemas"
    cp -r "$TEMPLATES_SRC/java-tdd" "$BUSINESS_REPO_PATH/openspec/schemas/"
    echo "✅ 已复制 java-tdd schema 到 $BUSINESS_REPO_PATH/openspec/schemas/java-tdd/"
  else
    echo "⚠️  未找到 java-tdd 模板源目录: $TEMPLATES_SRC/java-tdd"
  fi

  # 复制 config.yaml（若业务工程尚未配置）
  if [ -f "$TEMPLATES_SRC/config.yaml" ] && [ ! -f "$BUSINESS_REPO_PATH/openspec/config.yaml" ]; then
    cp "$TEMPLATES_SRC/config.yaml" "$BUSINESS_REPO_PATH/openspec/config.yaml"
    echo "✅ 已复制 config.yaml 到 $BUSINESS_REPO_PATH/openspec/"
  fi
fi

# 6. 确保 .gitignore 包含 OpenSpec 产物（在业务工程目录下）
if [ "$SKIP_OPENSPEC_INIT" != "true" ]; then
  grep -q 'openspec/' "$BUSINESS_REPO_PATH/.gitignore" 2>/dev/null || echo 'openspec/' >> "$BUSINESS_REPO_PATH/.gitignore"
  grep -q '.openspec.yaml' "$BUSINESS_REPO_PATH/.gitignore" 2>/dev/null || echo '.openspec.yaml' >> "$BUSINESS_REPO_PATH/.gitignore"
fi

# 7. 生成目录映射辅助脚本（符号链接桥接 req/ ↔ openspec/changes/）
# 脚本保存到业务工程，供后续每次 /opsx:new 后调用
if [ "$SKIP_OPENSPEC_INIT" != "true" ]; then
  mkdir -p "$BUSINESS_REPO_PATH/openspec"
  cat > "$BUSINESS_REPO_PATH/openspec/link-feature.sh" << 'LINKSCRIPT'
#!/usr/bin/env bash
# link-feature.sh — 为需求在 openspec/changes/ 下创建符号链接，指向 req/{feature_name}/
# 用法: bash openspec/link-feature.sh <feature_name>
# 调用时机: tech-design-agent OpenSpec 模式步骤 7（每次 /opsx:new 后执行）
#
# 目录映射方案（方案 A — 符号链接）：
#   req/{feature_name}/                     ← 主目录（所有文档写这里）
#   openspec/changes/{feature_name}/        ← 符号链接 → ../../req/{feature_name}/
#
# 这样 OpenSpec CLI 操作 openspec/changes/{feature_name}/ 时，
# 实际读写的是 req/{feature_name}/，目录结构统一。

set -euo pipefail

FEATURE_NAME="${1:?用法: $0 <feature_name>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

REQ_DIR="$REPO_ROOT/req/$FEATURE_NAME"
CHANGES_DIR="$REPO_ROOT/openspec/changes/$FEATURE_NAME"
CHANGES_PARENT="$REPO_ROOT/openspec/changes"

# 1. 确保 req/{feature_name}/ 主目录存在
mkdir -p "$REQ_DIR"

# 2. 确保 openspec/changes/ 父目录存在
mkdir -p "$CHANGES_PARENT"

# 3. 创建符号链接（相对路径，对 git clone 友好）
if [ -L "$CHANGES_DIR" ]; then
  echo "ℹ️  符号链接已存在: $CHANGES_DIR -> $(readlink "$CHANGES_DIR")"
elif [ -d "$CHANGES_DIR" ]; then
  echo "⚠️  $CHANGES_DIR 是普通目录（非符号链接），将迁移内容到 $REQ_DIR 后重建链接"
  # 迁移已有内容
  cp -rn "$CHANGES_DIR/." "$REQ_DIR/" 2>/dev/null || true
  rm -rf "$CHANGES_DIR"
  ln -s "../../req/$FEATURE_NAME" "$CHANGES_DIR"
  echo "✅ 迁移完成，符号链接已重建"
else
  # 创建新链接（相对路径）
  ln -s "../../req/$FEATURE_NAME" "$CHANGES_DIR"
  echo "✅ 符号链接已创建: openspec/changes/$FEATURE_NAME -> ../../req/$FEATURE_NAME"
fi

echo "📁 主目录: $REQ_DIR"
echo "🔗 链接入口: $CHANGES_DIR"
LINKSCRIPT
  chmod +x "$BUSINESS_REPO_PATH/openspec/link-feature.sh"
  echo "✅ 已生成目录映射辅助脚本: openspec/link-feature.sh"
fi
```

> **OpenSpec init 执行位置说明**：
> - `openspec init` **必须在业务工程根目录**（如 `your-app-name/`）执行，不能在 dev-workflow 目录执行
> - Agent 优先从 `.mrd-to-code-config.json` 的 `env.repo_path` 读取业务工程路径
> - 若读不到，提示用户手动在业务工程根目录执行 `openspec init . --tools claude`
> - 初始化后将 `plugin_availability.openspec.initialized=true` 和 `project_path` 写入配置
> - **java-tdd schema**：自动复制到 `{业务工程}/openspec/schemas/java-tdd/`，包含 5 个 artifact 模板
> - **config.yaml**：若业务工程无配置，自动复制默认配置（schema=java-tdd, context=Java技术栈, rules=编码规范）
> - **link-feature.sh**：目录映射辅助脚本，每次 `/opsx:new` 后由 tech-design-agent 调用，在 `openspec/changes/{feature_name}/` 创建指向 `req/{feature_name}/` 的符号链接

**L7 Beads**（任务追踪，**默认安装**）：
```bash
# BD_BIN 别名处理（Claude Code 非交互式 shell 不加载 ~/.zshrc）
export BD_BIN="${BD_BIN:-$(command -v bd 2>/dev/null || echo "$HOME/.local/bin/bd")}"

# 检测 Beads CLI
if ! command -v "$BD_BIN" >/dev/null 2>&1; then
  echo "Beads CLI 未安装，正在安装..."
  curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
  export BD_BIN="$HOME/.local/bin/bd"
fi

# 确定业务工程目录
BUSINESS_REPO_PATH="$(cat .mrd-to-code-config.json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('env',{}).get('repo_path',''))" 2>/dev/null)"

# 在目标目录初始化 Beads（含 dolt 损坏自动修复）
_beads_init_in_dir() {
  local TARGET_DIR="$1"
  # 首次尝试
  if (cd "$TARGET_DIR" && "$BD_BIN" init 2>&1); then
    echo "✅ Beads 初始化成功: $TARGET_DIR"
    return 0
  fi
  # 检测 dolt 损坏：repo_state.json 缺失
  local BEADS_DOLT_DIR="$TARGET_DIR/.beads/embeddeddolt"
  if [ -d "$BEADS_DOLT_DIR" ]; then
    echo "🔧 检测到损坏的 Beads dolt 数据，清空后重试..."
    find "$BEADS_DOLT_DIR" -type f -delete 2>/dev/null
    find "$BEADS_DOLT_DIR" -type d -empty -delete 2>/dev/null
    if (cd "$TARGET_DIR" && "$BD_BIN" init 2>&1); then
      echo "✅ Beads 重新初始化成功（dolt 已修复）: $TARGET_DIR"
      return 0
    fi
  fi
  echo "❌ Beads 初始化失败，请手动在 $TARGET_DIR 执行: $BD_BIN init"
  return 1
}

if [ -n "$BUSINESS_REPO_PATH" ] && [ -d "$BUSINESS_REPO_PATH" ]; then
  _beads_init_in_dir "$BUSINESS_REPO_PATH" && BEADS_TARGET="$BUSINESS_REPO_PATH" || BEADS_TARGET=""
elif [ -f "pom.xml" ]; then
  # 当前目录是业务工程
  _beads_init_in_dir "$(pwd)" && BEADS_TARGET="$(pwd)" || BEADS_TARGET=""
else
  echo "⚠️  未检测到业务工程路径，请在业务工程根目录手动执行: $BD_BIN init"
  BEADS_TARGET=""
fi

# 配置 Claude Code 集成（全局钩子）
$BD_BIN setup claude 2>/dev/null || true

# 验证
$BD_BIN setup claude --check 2>/dev/null || true
$BD_BIN prime 2>/dev/null || true
```

确保 CLAUDE.md 包含 Beads 指令（在业务工程目录）：
```bash
if [ -n "$BEADS_TARGET" ]; then
  grep -q "Use '\$BD_BIN' for task tracking" "$BEADS_TARGET/CLAUDE.md" 2>/dev/null \
    || echo -e "\n## Beads Issue Tracker\n\nUse '\$BD_BIN' for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists" >> "$BEADS_TARGET/CLAUDE.md"
  echo "✅ Beads 已初始化: $BEADS_TARGET/.beads/"
fi
```

写入 `plugin_availability.beads` 到配置文件：
```bash
# 更新 .mrd-to-code-config.json
python3 << 'EOF'
import json, os
config_path = '.mrd-to-code-config.json'
try:
    config = json.load(open(config_path))
except:
    config = {}
import subprocess, re

bd_bin = os.environ.get('BD_BIN', os.path.expanduser('~/.local/bin/bd'))

# 读取 bd version
try:
    version_out = subprocess.check_output([bd_bin, '--version'], stderr=subprocess.DEVNULL, text=True).strip()
    version = version_out.split()[-1] if version_out else 'unknown'
except Exception:
    version = 'unknown'

# 读取 bd info（backend/mode/database/issue_prefix）
backend, mode, database, issue_prefix = 'dolt', 'embedded', '', ''
try:
    info_out = subprocess.check_output([bd_bin, 'info'], stderr=subprocess.DEVNULL, text=True)
    for line in info_out.splitlines():
        if 'Backend:' in line:
            backend = line.split(':', 1)[-1].strip()
        elif 'Mode:' in line:
            mode = line.split(':', 1)[-1].strip()
        elif 'Database:' in line:
            database = line.split(':', 1)[-1].strip()
        elif 'Issue prefix:' in line or 'issue prefix' in line.lower():
            issue_prefix = re.split(r':\s*', line, 1)[-1].strip().rstrip('()')
except Exception:
    pass

# 若 bd info 不可用，从目录名推断
if not database and os.environ.get('BEADS_TARGET'):
    database = os.path.basename(os.environ['BEADS_TARGET']).replace('-', '_')
    issue_prefix = os.path.basename(os.environ['BEADS_TARGET'])

config.setdefault('plugin_availability', {})['beads'] = {
    'installed': True,
    'version': version,
    'path': bd_bin,
    'initialized': True,
    'backend': backend,
    'mode': mode,
    'database': database,
    'issue_prefix': issue_prefix
}
json.dump(config, open(config_path, 'w'), indent=2, ensure_ascii=False)
EOF
```

# Step 4 — 确保生成文件已加入 .gitignore

```bash
grep -q '\.mrd-to-code-config\.json' .gitignore 2>/dev/null \
  || echo '/.mrd-to-code-config.json' >> .gitignore
```
