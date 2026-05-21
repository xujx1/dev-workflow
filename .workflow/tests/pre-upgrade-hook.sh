#!/bin/bash
# pre-upgrade-hook.sh
# 插件版本更新前自动运行 L1 + L2 测试
# 失败时阻止自动更新

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$SCRIPT_DIR"

echo "=========================================="
echo "Pre-upgrade Hook: Running L1 + L2 Tests"
echo "=========================================="

# 运行 L1 契约测试
echo ""
echo "[1/2] Running L1 Contract Tests..."
cd "$TESTS_DIR"
node L1-contracts/check-contracts.js
L1_EXIT=$?

if [ $L1_EXIT -ne 0 ]; then
    echo ""
    echo "❌ L1 Contract Tests FAILED"
    echo "Blocking upgrade. Please fix contract violations before upgrading."
    exit 1
fi

# 运行 L2 流程模拟测试
echo ""
echo "[2/2] Running L2 Simulation Tests..."
node L2-simulations/run-simulations.js
L2_EXIT=$?

if [ $L2_EXIT -ne 0 ]; then
    echo ""
    echo "❌ L2 Simulation Tests FAILED"
    echo "Blocking upgrade. Please fix simulation failures before upgrading."
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ All Pre-upgrade Tests PASSED"
echo "Proceeding with upgrade..."
echo "=========================================="
exit 0
