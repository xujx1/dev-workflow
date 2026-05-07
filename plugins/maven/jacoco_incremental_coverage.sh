#!/bin/bash
#
# plugins/maven/jacoco_incremental_coverage.sh
#
# Maven 插件统一覆盖率入口。
# 当前先委托给 tdd-test-runner 内的正式实现，避免一次性大搬迁；
# 外部调用方后续统一依赖本路径，便于后面继续收口实现位置。
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_SCRIPT="$(cd "$SCRIPT_DIR/../../agents/tdd-test-runner/assets" && pwd)/jacoco_incremental_coverage.sh"

if [[ ! -f "$TARGET_SCRIPT" ]]; then
  echo "❌ 未找到 JaCoCo 增量覆盖率脚本：$TARGET_SCRIPT" >&2
  exit 1
fi

exec bash "$TARGET_SCRIPT" "$@"
