#!/bin/bash
# ensure-dirs.sh - 创建标准目录结构
# 用法: ./ensure-dirs.sh [--dry-run]

set -e

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
fi

# 标准目录列表
STANDARD_DIRS=(
    "artifacts"
    "output"
    ".workflow"
    "req"
)

# 从配置文件读取允许的路径
CONFIG_FILE=".workflow/orchestrator-safe-ops.yml"

log_operation() {
    local action="$1"
    local path="$2"
    local result="$3"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "{\"ts\":\"$timestamp\",\"op\":\"ensure_dir\",\"path\":\"$path\",\"action\":\"$action\",\"result\":\"$result\"}"
}

ensure_dir() {
    local dir="$1"
    if [[ -d "$dir" ]]; then
        echo "[SKIP] $dir already exists"
        log_operation "check" "$dir" "exists"
    else
        if [[ "$DRY_RUN" == "true" ]]; then
            echo "[DRY-RUN] Would create: $dir"
            log_operation "create" "$dir" "would_create"
        else
            mkdir -p "$dir"
            echo "[CREATED] $dir"
            log_operation "create" "$dir" "created"
        fi
    fi
}

# 主逻辑
echo "=== Directory Structure Check ==="

for dir in "${STANDARD_DIRS[@]}"; do
    ensure_dir "$dir"
done

echo "=== Done ==="

# 追加到审计日志
if [[ -f ".workflow/ops-audit.log" ]] || [[ "$DRY_RUN" == "false" ]]; then
    # 审计日志由调用方负责写入
    true
fi
