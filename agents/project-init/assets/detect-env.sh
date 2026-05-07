#!/bin/bash
# Step 1 — 清理环境干扰
rm -f ~/.pyenv/shims/.pyenv-shim 2>/dev/null; true

# Step 2 — 检测 Java/Maven 环境

# Java 检测
java_raw=$(java -version 2>&1)
java_version=$(echo "$java_raw" | head -1 | awk -F '"' '{print $2}')
java_vendor=$(echo "$java_raw" | head -1 | awk -F '"' '{print $1}' | sed 's/^[[:space:]]//')
java_home=$(echo $JAVA_HOME)

# Maven 检测
maven_version=$(mvn -version 2>/dev/null | head -1 | awk '{print $3}')
maven_home=$(dirname $(dirname $(readlink $(which mvn) 2>/dev/null || echo $(which mvn))))

if [ -z "$java_version" ] || [ -z "$maven_version" ]; then
  echo "❌ Java 或 Maven 未检测到，终止"
  exit 1
fi
