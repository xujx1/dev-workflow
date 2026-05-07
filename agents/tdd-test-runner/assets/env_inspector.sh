#!/bin/bash
#
# TDD Unit Test Runner - Environment Inspector
# 自动探测 Maven、JDK 版本与路径
#
# 用法: ./env_inspector.sh [--json]
#   --json  输出 JSON 格式（便于程序解析）
#

set -euo pipefail

OUTPUT_FORMAT="text"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOLVER_SCRIPT="$(cd "$SCRIPT_DIR/../../../plugins/maven" && pwd)/maven_config_resolver.py"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --json)
            OUTPUT_FORMAT="json"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

detect_idea_version() {
    local idea_opt=""
    if [[ -d "$HOME/Library/Application Support/JetBrains" ]]; then
        idea_opt=$(ls "$HOME/Library/Application Support/JetBrains/" 2>/dev/null | grep -Ei 'IntelliJIdea|IdeaIC' | sort -V | tail -1 || true)
    elif [[ -d "$HOME/.config/JetBrains" ]]; then
        idea_opt=$(ls "$HOME/.config/JetBrains/" 2>/dev/null | grep -Ei 'IntelliJIdea|IdeaIC' | sort -V | tail -1 || true)
    fi
    echo "$idea_opt"
}

detect_jdk_list() {
    local idea_opt="$1"
    local jdk_table=""

    if [[ -f "$HOME/Library/Application Support/JetBrains/$idea_opt/options/jdk.table.xml" ]]; then
        jdk_table="$HOME/Library/Application Support/JetBrains/$idea_opt/options/jdk.table.xml"
    elif [[ -f "$HOME/.config/JetBrains/$idea_opt/options/jdk.table.xml" ]]; then
        jdk_table="$HOME/.config/JetBrains/$idea_opt/options/jdk.table.xml"
    else
        return 1
    fi

    python3 - "$jdk_table" << 'PY'
import json
import sys
import xml.etree.ElementTree as ET

result = []
try:
    for jdk in ET.parse(sys.argv[1]).getroot().iter('jdk'):
        n = jdk.find('.//name')
        h = jdk.find('.//homePath')
        v = jdk.find('.//version')
        result.append({
            "name": n.get('value') if n is not None else '?',
            "path": h.get('value') if h is not None else '?',
            "version": v.get('value') if v is not None else '?',
        })
except Exception:
    result = []

print(json.dumps(result, ensure_ascii=False))
PY
}

detect_project_jdk() {
    local misc_file=".idea/misc.xml"
    [[ -f "$misc_file" ]] || return 1
    grep 'project-jdk' "$misc_file" 2>/dev/null | head -1
}

detect_idea_jdk_home() {
    local idea_opt="$1"
    local jdk_table=""
    local misc_file=".idea/misc.xml"
    local project_jdk_name=""

    if [[ -f "$HOME/Library/Application Support/JetBrains/$idea_opt/options/jdk.table.xml" ]]; then
        jdk_table="$HOME/Library/Application Support/JetBrains/$idea_opt/options/jdk.table.xml"
    elif [[ -f "$HOME/.config/JetBrains/$idea_opt/options/jdk.table.xml" ]]; then
        jdk_table="$HOME/.config/JetBrains/$idea_opt/options/jdk.table.xml"
    else
        return 1
    fi

    if [[ -f "$misc_file" ]]; then
        project_jdk_name=$(python3 - "$misc_file" << 'PY'
import sys
import xml.etree.ElementTree as ET
try:
    root = ET.parse(sys.argv[1]).getroot()
    for comp in root.iter("component"):
        if comp.get("name") == "ProjectRootManager":
            print(comp.get("project-jdk-name", ""))
            break
except Exception:
    pass
PY
)
    fi

    python3 - "$jdk_table" "$project_jdk_name" << 'PY'
import os
import sys
import xml.etree.ElementTree as ET

def expand(value: str) -> str:
    return os.path.expanduser(value.replace("$USER_HOME$", os.path.expanduser("~")))

table, preferred = sys.argv[1], sys.argv[2]
try:
    root = ET.parse(table).getroot()
    jdks = []
    for jdk in root.iter("jdk"):
        name = jdk.find(".//name")
        home = jdk.find(".//homePath")
        jdks.append((name.get("value", "") if name is not None else "", expand(home.get("value", "")) if home is not None else ""))

    if preferred:
        for name, home in jdks:
            if name == preferred and home:
                print(home)
                raise SystemExit

    for _, home in jdks:
        if home:
            print(home)
            raise SystemExit
except Exception:
    pass
PY
}

detect_maven_resolution() {
    python3 "$RESOLVER_SCRIPT" --project-root "$PWD" --format json
}

validate_java_home() {
    local candidate_home="$1"
    local candidate_type="$2"
    [[ -n "$candidate_home" ]] || return 1
    [[ -x "$candidate_home/bin/java" ]] || return 1

    local version_output=""
    if ! version_output=$("$candidate_home/bin/java" -version 2>&1 | head -1); then
        return 1
    fi

    python3 - "$candidate_home" "$version_output" "$candidate_type" << 'PY'
import json
import sys

print(json.dumps({
    "path": sys.argv[1],
    "version": sys.argv[2],
    "type": sys.argv[3],
}, ensure_ascii=False))
PY
}

detect_system_jdk() {
    local preferred_java_home="${1:-}"

    if [[ -n "$preferred_java_home" ]]; then
        local preferred_java_info
        preferred_java_info=$(validate_java_home "$preferred_java_home" "idea" 2>/dev/null || true)
        if [[ -n "$preferred_java_info" ]]; then
            echo "$preferred_java_info"
            return 0
        fi
    fi

    if [[ -n "${JAVA_HOME:-}" ]]; then
        local java_home_info
        java_home_info=$(validate_java_home "$JAVA_HOME" "JAVA_HOME" 2>/dev/null || true)
        if [[ -n "$java_home_info" ]]; then
            echo "$java_home_info"
            return 0
        fi
    fi

    if [[ "$(uname -s)" == "Darwin" && -x "/usr/libexec/java_home" ]]; then
        local macos_java_home
        local macos_java_info
        macos_java_home=$(/usr/libexec/java_home 2>/dev/null || true)
        macos_java_info=$(validate_java_home "$macos_java_home" "java_home" 2>/dev/null || true)
        if [[ -n "$macos_java_info" ]]; then
            echo "$macos_java_info"
            return 0
        fi
    fi

    if command -v java >/dev/null 2>&1; then
        local java_bin
        local java_home
        local java_info
        java_bin="$(command -v java)"
        java_home="$(python3 -c 'import os,sys; print(os.path.dirname(os.path.dirname(os.path.realpath(sys.argv[1]))))' "$java_bin" 2>/dev/null || echo "")"
        java_info=$(validate_java_home "$java_home" "system" 2>/dev/null || true)
        if [[ -n "$java_info" ]]; then
            echo "$java_info"
            return 0
        fi
    fi

    return 1
}

detect_project_type() {
    local project_root="$PWD"
    local project_type="Unknown"

    if [[ -f "pom.xml" ]]; then
        project_type="Maven"
    elif [[ -f "build.gradle" || -f "build.gradle.kts" ]]; then
        project_type="Gradle"
    fi

    echo "{\"type\": \"${project_type}\", \"root\": \"${project_root}\"}"
}

main() {
    local idea_opt=""
    local jdk_list='[]'
    local project_jdk=""
    local maven_resolution='{}'
    local jdk_info='{"error": "JDK not found"}'
    local project_info='{}'
    local preferred_java_home=""

    idea_opt=$(detect_idea_version)
    jdk_list=$(detect_jdk_list "$idea_opt" 2>/dev/null || echo '[]')
    project_jdk=$(detect_project_jdk 2>/dev/null || echo "")
    maven_resolution=$(detect_maven_resolution 2>/dev/null || echo '{}')
    preferred_java_home=$(python3 - "$maven_resolution" << 'PY'
import json
import sys
data = json.loads(sys.argv[1])
print(data.get("preferred_java_home", ""))
PY
)
    jdk_info=$(detect_system_jdk "$preferred_java_home" 2>/dev/null || echo '{"error": "JDK not found"}')
    project_info=$(detect_project_type)

    if [[ "$OUTPUT_FORMAT" == "json" ]]; then
        python3 - "$idea_opt" "$jdk_list" "$project_jdk" "$maven_resolution" "$jdk_info" "$project_info" << 'PY'
import json
import sys

idea_opt, jdk_list_raw, project_jdk, maven_raw, jdk_raw, project_raw = sys.argv[1:]

payload = {
    "idea_version": idea_opt,
    "jdk_list": json.loads(jdk_list_raw),
    "project_jdk_hint": project_jdk,
    "maven_resolution": json.loads(maven_raw),
    "maven": json.loads(maven_raw),
    "jdk": json.loads(jdk_raw),
    "project": json.loads(project_raw),
}

print(json.dumps(payload, ensure_ascii=False))
PY
        return
    fi

    echo "========================================"
    echo "🔍 TDD 环境探测结果"
    echo "========================================"
    echo ""
    echo "IDEA 版本: ${idea_opt:-未检测到}"
    echo ""
    echo "--- JDK 列表 (IDEA 全局) ---"
    python3 - "$jdk_list" << 'PY'
import json
import sys

data = json.loads(sys.argv[1])
if not data:
    print("  无数据")
else:
    for jdk in data:
        print("  名称:", jdk["name"])
        print("  路径:", jdk["path"])
        print("  版本:", jdk["version"])
        print()
PY
    echo ""
    echo "--- 项目 JDK ---"
    if [[ -n "$project_jdk" ]]; then
        echo "  $project_jdk"
    else
        echo "  未配置"
    fi
    echo ""
    echo "--- Maven 配置 ---"
    python3 - "$maven_resolution" << 'PY'
import json
import sys

data = json.loads(sys.argv[1])
source_chain = " -> ".join(data.get("source_chain", [])) or "未检测到"
print(f"  解析来源: {source_chain}")
print(f"  Maven 命令: {data.get('maven_command') or '未找到'}")
print(f"  Maven 版本: {data.get('maven_version') or '未检测到'}")
print(f"  Maven Home: {data.get('maven_home') or '未解析'}")
print(f"  命令来源: {data.get('command_source') or '未知'}")
print(f"  命令健康度: {'可用' if data.get('command_healthy') else '不可用'}")
print(f"  用户设置文件: {data.get('user_settings_file') or '未解析'}")
print(f"  本地 Maven 仓库: {data.get('local_repository') or '未解析'}")
PY
    echo ""
    echo "--- JDK 探测 ---"
    python3 - "$jdk_info" << 'PY'
import json
import sys

data = json.loads(sys.argv[1])
if "error" in data:
    print("  ❌ 未找到 JDK")
else:
    print(f"  {data.get('type')}: {data.get('version')} @ {data.get('path')}")
PY
    echo ""
    echo "--- 工程信息 ---"
    python3 - "$project_info" << 'PY'
import json
import sys

data = json.loads(sys.argv[1])
print(f"  Project: {data.get('type')} @ {data.get('root')}")
PY
    echo ""
    echo "========================================"
    echo "✅ 环境探测完成"
    echo "========================================"
}

main
