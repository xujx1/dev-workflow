#!/bin/bash
#
# jacoco_incremental_coverage.sh
#
# 跨模块 JaCoCo 增量覆盖率聚合脚本
#
# 功能：
#   1. 自动发现多模块工程下所有子模块的 target/classes 目录，合并 class 文件
#   2. 使用 JaCoCo API（standalone Java 程序）加载 jacoco.exec + 合并 class 目录，生成跨模块覆盖率 XML
#   3. 解析 git diff 新增行（--unified=0），与 JaCoCo XML 行级数据交叉比对
#   4. 输出精确增量行覆盖率 + 增量分支覆盖率（按文件明细 + 合计）
#
# 用法：
#   bash jacoco_incremental_coverage.sh [选项]
#
# 选项：
#   --project-root    DIR    工程根目录（默认：${PWD})
#   --exec-file       FILE   jacoco.exec 文件路径（默认：自动搜索最大 .exec）
#   --base-branch     BRANCH 基线分支（默认：origin/master）
#   --change-manifest FILE   Phase 2 变更清单路径（默认：空，脚本自行回退到 git diff）
#   --java-home       DIR    JDK 主目录（默认：$JAVA_HOME 或 /usr/bin/java 推断）
#   --output-xml      FILE   输出 XML 路径（默认：/tmp/jacoco-incremental-report.xml）
#   --output-format   FORMAT 输出格式：text（默认）或 json
#   --help                   显示帮助
#
# 输出（text 格式）：
#   文件级别覆盖率明细 + 合计增量行覆盖率 + 合计增量分支覆盖率
#
# 输出（json 格式）：
#   {"files": [...], "total_line_pct": 80.0, "total_branch_pct": 80.0, "status": "ok"}
#
# 依赖：
#   - JDK 8+ (java, javac)
#   - Python 3 (解析 XML、计算覆盖率)
#   - git
#   - JaCoCo jars（自动从已解析的 Maven 本地仓库搜索，优先项目/IDEA 显式配置）
#

set -euo pipefail

# ─── 默认参数 ───────────────────────────────────────────────────────────────
PROJECT_ROOT="${PWD}"
EXEC_FILE=""
BASE_BRANCH="origin/master"
CHANGE_MANIFEST=""
JAVA_HOME_OVERRIDE=""
OUTPUT_XML="/tmp/jacoco-incremental-report.xml"
OUTPUT_FORMAT="text"
MERGE_DIR="/tmp/jacoco-merged-classes-$$"   # 带 PID 避免并发冲突
NO_CACHE=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAVEN_RESOLVER_SCRIPT="$(cd "$SCRIPT_DIR/../../../plugins/maven" && pwd)/maven_config_resolver.py"
MAVEN_LOCAL_REPO=""

# ─── 缓存配置（v1.2.0 新增）──────────────────────────────────────────────────
CACHE_DIR="${HOME}/.tdd-test-runner/cache"
CACHE_TTL_DAYS=7
JACOCO_CP_CACHE="${CACHE_DIR}/jacoco-classpath.cache"
JACOCO_REPORT_CLASSES_DIR="${CACHE_DIR}/jacoco-report-classes"

# ─── 参数解析 ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --project-root)   PROJECT_ROOT="$2"; shift 2 ;;
        --exec-file)      EXEC_FILE="$2";    shift 2 ;;
        --base-branch)    BASE_BRANCH="$2";  shift 2 ;;
        --change-manifest) CHANGE_MANIFEST="$2"; shift 2 ;;
        --java-home)      JAVA_HOME_OVERRIDE="$2"; shift 2 ;;
        --output-xml)     OUTPUT_XML="$2";   shift 2 ;;
        --output-format)  OUTPUT_FORMAT="$2"; shift 2 ;;
        --no-cache)       NO_CACHE=true; shift ;;
        --help)
            sed -n '2,50p' "$0" | grep '^#' | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "未知参数: $1" >&2; exit 1 ;;
    esac
done

# ─── 初始化缓存目录 ──────────────────────────────────────────────────────────
init_cache_dir() {
    if [[ "$NO_CACHE" == "false" ]]; then
        mkdir -p "$CACHE_DIR"
    fi
}

clear_runner_cache() {
    rm -f "$JACOCO_CP_CACHE" 2>/dev/null || true
    rm -rf "$JACOCO_REPORT_CLASSES_DIR" 2>/dev/null || true
}

# 检查缓存文件是否有效（在 TTL 内）
cache_is_valid() {
    local cache_file="$1"
    [[ -f "$cache_file" ]] && [[ $(find "$cache_file" -mtime -$CACHE_TTL_DAYS 2>/dev/null) ]]
}

# ─── 工具函数 ────────────────────────────────────────────────────────────────
log()  { [[ "$OUTPUT_FORMAT" == "text" ]] && echo "$*" >&2 || true; }
info() { [[ "$OUTPUT_FORMAT" == "text" ]] && echo "  $*" >&2 || true; }
warn() { echo "⚠️  $*" >&2; }
die()  { echo "❌ $*" >&2; exit 1; }

# 清理临时目录
cleanup() { rm -rf "$MERGE_DIR" 2>/dev/null || true; }
trap cleanup EXIT

resolve_maven_local_repo() {
    if [[ -n "$MAVEN_LOCAL_REPO" ]]; then
        echo "$MAVEN_LOCAL_REPO"
        return
    fi

    if [[ -f "$MAVEN_RESOLVER_SCRIPT" ]]; then
        local resolved_repo
        resolved_repo=$(python3 "$MAVEN_RESOLVER_SCRIPT" --project-root "$PROJECT_ROOT" --format json 2>/dev/null \
            | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get("local_repository",""))' 2>/dev/null || true)
        if [[ -n "$resolved_repo" ]]; then
            MAVEN_LOCAL_REPO="$resolved_repo"
            echo "$MAVEN_LOCAL_REPO"
            return
        fi
    fi

    MAVEN_LOCAL_REPO="${HOME}/.m2/repository"
    echo "$MAVEN_LOCAL_REPO"
}

# ─── Step 1：定位 JDK ────────────────────────────────────────────────────────
resolve_java_home() {
    if [[ -n "$JAVA_HOME_OVERRIDE" ]]; then
        echo "$JAVA_HOME_OVERRIDE"
        return
    fi
    if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
        echo "$JAVA_HOME"
        return
    fi
    # 从 java 可执行文件推断
    local java_bin
    java_bin=$(which java 2>/dev/null) || die "未找到 java，请通过 --java-home 指定 JDK 路径"
    # 解析符号链接
    local real_java
    real_java=$(python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$java_bin" 2>/dev/null || echo "$java_bin")
    echo "$(dirname "$(dirname "$real_java")")"
}

# ─── Step 2：定位 JaCoCo 相关 jar ────────────────────────────────────────────
# 从已解析的 Maven 本地仓库中搜索所需 jar（支持多版本，取最新）
find_jar() {
    local artifact="$1"     # e.g. jacoco-core  asm
    local group_path="$2"   # e.g. org/jacoco   org/ow2/asm
    local repo_root
    repo_root="$(resolve_maven_local_repo)"
    local m2="${repo_root}/${group_path}"
    local jar

    # 找所有版本，取字典序最大（通常是最新版）
    jar=$(find "$m2" -name "${artifact}-*.jar" 2>/dev/null \
        | grep -v 'sources\|javadoc\|tests' \
        | sort -V | tail -1)

    if [[ -z "$jar" ]]; then
        return 1
    fi
    echo "$jar"
}

resolve_jacoco_classpath() {
    # 优先使用缓存
    if [[ "$NO_CACHE" == "false" ]] && cache_is_valid "$JACOCO_CP_CACHE"; then
        info "使用缓存的 JaCoCo classpath"
        cat "$JACOCO_CP_CACHE"
        return
    fi

    local cp=""
    info "JaCoCo 依赖仓库: $(resolve_maven_local_repo)"

    # JaCoCo core（必须）— M2 路径为 org/jacoco/org.jacoco.core
    local core; core=$(find_jar "org.jacoco.core" "org/jacoco/org.jacoco.core") \
        || die "未找到 org.jacoco.core jar，请先执行 mvn test（会自动下载 JaCoCo）"

    # JaCoCo report（必须）— M2 路径为 org/jacoco/org.jacoco.report
    local report; report=$(find_jar "org.jacoco.report" "org/jacoco/org.jacoco.report") \
        || die "未找到 org.jacoco.report jar"

    # ASM（必须）
    local asm; asm=$(find_jar "asm" "org/ow2/asm/asm") \
        || asm=$(find_jar "asm" "asm/asm") \
        || die "未找到 asm jar"

    # ASM tree（可能不存在，容错）
    local asm_tree
    asm_tree=$(find_jar "asm-tree" "org/ow2/asm/asm-tree") \
        || asm_tree=$(find_jar "asm-tree" "asm/asm-tree") || true

    # ASM commons（可能不存在，容错）
    local asm_commons
    asm_commons=$(find_jar "asm-commons" "org/ow2/asm/asm-commons") \
        || asm_commons=$(find_jar "asm-commons" "asm/asm-commons") || true

    cp="$core:$report:$asm"
    [[ -n "${asm_tree:-}" ]]    && cp="$cp:$asm_tree"
    [[ -n "${asm_commons:-}" ]] && cp="$cp:$asm_commons"

    # 写入缓存
    if [[ "$NO_CACHE" == "false" ]]; then
        echo "$cp" > "$JACOCO_CP_CACHE"
        info "JaCoCo classpath 已缓存到 $JACOCO_CP_CACHE"
    fi

    echo "$cp"
}

# ─── Step 3：定位 jacoco.exec ─────────────────────────────────────────────────
resolve_exec_file() {
    if [[ -n "$EXEC_FILE" ]]; then
        [[ -f "$EXEC_FILE" ]] || die "指定的 exec 文件不存在：$EXEC_FILE"
        echo "$EXEC_FILE"
        return
    fi

    # 自动搜索：取最大的 jacoco.exec（通常来自 interfaces 模块测试运行后）
    # 兼容 macOS（du -b 不可用），改用 wc -c 获取字节数
    local found
    found=$(find "$PROJECT_ROOT" -name "jacoco.exec" -not -path "*/test-classes/*" 2>/dev/null \
        | while read -r f; do echo "$(wc -c < "$f" | tr -d ' ') $f"; done \
        | sort -k1 -rn \
        | head -1 \
        | awk '{print $2}')

    [[ -z "$found" ]] && die "未找到 jacoco.exec，请先运行测试（mvn test）再执行本脚本"
    echo "$found"
}

# ─── Step 4：合并所有模块 class 目录 ─────────────────────────────────────────
merge_class_dirs() {
    mkdir -p "$MERGE_DIR"

    local module_count=0
    local class_count=0

    # 查找所有 target/classes 目录（排除 test-classes）
    while IFS= read -r class_dir; do
        # 跳过空目录
        [[ -d "$class_dir" ]] || continue

        local count
        count=$(find "$class_dir" -name "*.class" 2>/dev/null | wc -l | tr -d ' ')
        [[ "$count" -eq 0 ]] && continue

        # 复制（rsync 更高效，回退到 cp -r）
        if command -v rsync &>/dev/null; then
            rsync -a --ignore-existing "$class_dir/" "$MERGE_DIR/" 2>/dev/null || true
        else
            cp -rn "$class_dir/." "$MERGE_DIR/" 2>/dev/null || true
        fi

        module_count=$((module_count + 1))
        class_count=$((class_count + count))
    done < <(find "$PROJECT_ROOT" -type d -name "classes" \
                 -path "*/target/classes" \
                 -not -path "*/test-classes/*" \
                 2>/dev/null | sort)

    [[ "$module_count" -eq 0 ]] && die "未找到任何 target/classes 目录，请先执行 mvn compile 或 mvn test"

    info "合并了 $module_count 个模块，共 $class_count 个 class 文件 → $MERGE_DIR"
    echo "$MERGE_DIR"
}

# ─── Step 5：生成跨模块 JaCoCo XML ────────────────────────────────────────────
generate_jacoco_xml() {
    local java_home="$1"
    local jacoco_cp="$2"
    local exec_file="$3"
    local merged_classes="$4"
    local output_xml="$5"

    local java_bin="$java_home/bin/java"
    local javac_bin="$java_home/bin/javac"

    # JacocoReport.java 源码（用于预编译）
    local jacoco_report_src
    jacoco_report_src=$(cat << 'JAVA'
import org.jacoco.core.analysis.*;
import org.jacoco.core.data.*;
import org.jacoco.core.tools.*;
import org.jacoco.report.*;
import org.jacoco.report.xml.*;
import java.io.*;

/**
 * 跨模块 JaCoCo XML 报告生成器
 * 用法：java JacocoReport <exec_file> <classes_dir> <output_xml>
 */
public class JacocoReport {
    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.err.println("用法: java JacocoReport <exec_file> <classes_dir> <output_xml>");
            System.exit(1);
        }

        String execFilePath  = args[0];
        String classesDirPath = args[1];
        String outputXmlPath = args[2];

        // 加载 exec 文件
        ExecFileLoader loader = new ExecFileLoader();
        loader.load(new File(execFilePath));
        ExecutionDataStore executionData = loader.getExecutionDataStore();
        SessionInfoStore sessionInfos   = loader.getSessionInfoStore();

        // 分析 class 文件
        CoverageBuilder coverageBuilder = new CoverageBuilder();
        Analyzer analyzer = new Analyzer(executionData, coverageBuilder);
        analyzer.analyzeAll(new File(classesDirPath));

        // 生成 XML
        IBundleCoverage bundle = coverageBuilder.getBundle("MultiModuleBundle");
        XMLFormatter xmlFormatter = new XMLFormatter();
        IReportVisitor visitor = xmlFormatter.createVisitor(
            new FileOutputStream(new File(outputXmlPath)));
        visitor.visitInfo(sessionInfos.getInfos(), executionData.getContents());
        // source locator 设为 null：仅生成覆盖率数据，无需源码
        visitor.visitBundle(bundle, new ISourceFileLocator() {
            public Reader getSourceFile(String packageName, String fileName) { return null; }
            public int getTabWidth() { return 4; }
        });
        visitor.visitEnd();

        // 打印各类覆盖率摘要到 stdout
        ICounter lineTotal   = bundle.getLineCounter();
        ICounter branchTotal = bundle.getBranchCounter();
        System.out.printf("BUNDLE LINE   %d/%d%n",
            lineTotal.getCoveredCount(), lineTotal.getTotalCount());
        System.out.printf("BUNDLE BRANCH %d/%d%n",
            branchTotal.getCoveredCount(), branchTotal.getTotalCount());

        for (IPackageCoverage pkg : bundle.getPackages()) {
            for (IClassCoverage cls : pkg.getClasses()) {
                ICounter lc = cls.getLineCounter();
                ICounter bc = cls.getBranchCounter();
                // 只输出有覆盖记录的类
                if (lc.getTotalCount() > 0 || bc.getTotalCount() > 0) {
                    System.out.printf("CLASS %s LINE %d/%d BRANCH %d/%d%n",
                        cls.getName(),
                        lc.getCoveredCount(), lc.getTotalCount(),
                        bc.getCoveredCount(), bc.getTotalCount());
                }
            }
        }
    }
}
JAVA
)

    # 检查是否可以使用预编译的 JacocoReport classes 目录
    local use_precompiled=false
    if [[ "$NO_CACHE" == "false" ]] && [[ -f "$JACOCO_REPORT_CLASSES_DIR/JacocoReport.class" ]]; then
        use_precompiled=true
        info "使用预编译的 JacocoReport classes"
    fi

    local tmp_cls=""
    if [[ "$use_precompiled" == "true" ]]; then
        tmp_cls="$JACOCO_REPORT_CLASSES_DIR"
    else
        # 写 JacocoReport.java 到临时目录（文件名必须与公共类名一致）
        local tmp_dir="/tmp/jacoco_src_$$"
        mkdir -p "$tmp_dir"
        local tmp_src="$tmp_dir/JacocoReport.java"
        if [[ "$NO_CACHE" == "false" ]]; then
            tmp_cls="$JACOCO_REPORT_CLASSES_DIR"
            rm -rf "$tmp_cls"
            mkdir -p "$tmp_cls"
        else
            tmp_cls="/tmp/jacoco_cls_$$"
            mkdir -p "$tmp_cls"
        fi

        echo "$jacoco_report_src" > "$tmp_src"

        # 编译
        info "编译 JacocoReport.java..."
        "$javac_bin" -cp "$jacoco_cp" "$tmp_src" -d "$tmp_cls" 2>/tmp/javac_err_$$ \
            || { warn "JacocoReport.java 编译失败：$(cat /tmp/javac_err_$$)"; rm -f "$tmp_src" /tmp/javac_err_$$; exit 1; }
        rm -f "$tmp_src" /tmp/javac_err_$$

        # 使用缓存目录直接作为编译输出目录，确保匿名内部类等附属 class 一并缓存
        if [[ "$NO_CACHE" == "false" ]]; then
            info "JacocoReport classes 已缓存到 $JACOCO_REPORT_CLASSES_DIR"
        fi
    fi

    # 运行
    "$java_bin" -cp "$tmp_cls:$jacoco_cp" JacocoReport \
        "$exec_file" "$merged_classes" "$output_xml" 2>/tmp/java_err_$$ \
        || {
            local java_err
            java_err="$(cat /tmp/java_err_$$)"
            if [[ "$NO_CACHE" == "false" ]] && [[ "$java_err" =~ (NoClassDefFoundError|ClassNotFoundException) ]]; then
                warn "检测到缓存 class 故障，已清理 runner cache，请使用 --no-cache 重试一次：$java_err"
                clear_runner_cache
            fi
            warn "JacocoReport 运行失败：$java_err"
            rm -rf /tmp/java_err_$$
            exit 1
        }
    rm -rf /tmp/java_err_$$

    info "跨模块 JaCoCo XML 已生成：$output_xml"
}

# ─── Step 6：Python 计算精确增量覆盖率 ────────────────────────────────────────
compute_incremental_coverage() {
    local xml_file="$1"
    local base_branch="$2"
    local project_root="$3"
    local fmt="$4"
    local change_manifest="$5"

    python3 - "$xml_file" "$base_branch" "$project_root" "$fmt" "$change_manifest" << 'PY'
import sys, re, subprocess, xml.etree.ElementTree as ET, json

xml_file    = sys.argv[1]
base_branch = sys.argv[2]
project_root = sys.argv[3]
fmt         = sys.argv[4]
change_manifest = sys.argv[5]

# ── 覆盖率排除规则（无业务逻辑的类）─────────────────────────────────────────
EXCLUDE_PATTERNS = [
    'DTO',
    'VO',
    'Query',
    'Request',
    'Response',
    'Mapper',
    'DO',
    'Entity',
    'DAO',
]

def should_exclude(filepath):
    basename = filepath.split('/')[-1].replace('.java', '')
    for pattern in EXCLUDE_PATTERNS:
        if pattern in basename:
            return True
    return False

# ── 解析 JaCoCo XML：按 package/sourcefile 建立行级覆盖映射 ───────────────
# 映射结构：{package/path/File.java: {line_nr: {"line_covered": bool, ...}}}
tree = ET.parse(xml_file)
root = tree.getroot()
coverage_map = {}

for pkg in root.findall('.//package'):
    pkg_name = (pkg.get('name') or '').strip('/')
    for sf in pkg.findall('sourcefile'):
        fname = sf.get('name')
        key = f"{pkg_name}/{fname}" if pkg_name else fname
        if key not in coverage_map:
            coverage_map[key] = {}
        for line in sf.findall('line'):
            nr = int(line.get('nr'))
            ci = int(line.get('ci', 0))   # covered instructions
            cb = int(line.get('cb', 0))   # covered branches
            mb = int(line.get('mb', 0))   # missed branches
            coverage_map[key][nr] = {
                "line_covered": ci > 0,
                "branch_covered": cb,
                "branch_missed": mb,
            }

# ── manifest / git diff 提取新增行号 ──────────────────────────────────────
def normalize_rel_path(path_value):
    path_value = path_value.replace('\\', '/').strip()
    while path_value.startswith('./'):
        path_value = path_value[2:]
    return path_value

def parse_manifest(manifest_file):
    if not manifest_file:
        return []
    try:
        raw = open(manifest_file, 'r', encoding='utf-8').read().splitlines()
    except FileNotFoundError:
        return []

    results = []
    seen = set()
    for line in raw:
        for match in re.findall(r'([A-Za-z0-9_./-]+\.java)\b', line):
            normalized = normalize_rel_path(match)
            if normalized not in seen:
                seen.add(normalized)
                results.append(normalized)
    return results

def run_git_diff(command):
    try:
        result = subprocess.run(command, capture_output=True, text=True, cwd=project_root)
        if result.returncode != 0:
            return ""
        return result.stdout
    except Exception:
        return ""

def parse_added_lines(diff):
    added_map = {}
    current_file = None
    current_start = None

    for raw_line in diff.split('\n'):
        # 文件头：+++ b/path/to/File.java
        m_file = re.match(r'^\+\+\+ b/(.+)', raw_line)
        if m_file:
            current_file = normalize_rel_path(m_file.group(1))
            if current_file not in added_map:
                added_map[current_file] = set()
            current_start = None
            continue

        # hunk 头：@@ -a,b +c,d @@
        m_hunk = re.match(r'^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@', raw_line)
        if m_hunk:
            current_start = int(m_hunk.group(1)) - 1
            continue

        if current_file is None or current_start is None:
            continue

        if raw_line.startswith('+++'):
            continue

        if raw_line.startswith('+'):
            current_start += 1
            added_map[current_file].add(current_start)
        elif not raw_line.startswith('-'):
            current_start += 1

    return added_map

def collect_manifest_backed_diffs(manifest_files):
    added_map = {}
    for rel_path in manifest_files:
        base_diff = run_git_diff(["git", "diff", "--unified=0", f"{base_branch}...HEAD", "--", rel_path])
        worktree_diff = run_git_diff(["git", "diff", "--unified=0", "HEAD", "--", rel_path])
        for partial in (parse_added_lines(base_diff), parse_added_lines(worktree_diff)):
            for file_path, lines in partial.items():
                added_map.setdefault(file_path, set()).update(lines)
    return added_map

def collect_fallback_diffs():
    base_diff = run_git_diff(["git", "diff", "--unified=0", f"{base_branch}...HEAD", "--", "*.java"])
    added_map = parse_added_lines(base_diff)
    if added_map:
        worktree_diff = run_git_diff(["git", "diff", "--unified=0", "HEAD", "--", "*.java"])
        for file_path, lines in parse_added_lines(worktree_diff).items():
            added_map.setdefault(file_path, set()).update(lines)
        return added_map
    worktree_diff = run_git_diff(["git", "diff", "--unified=0", "HEAD", "--", "*.java"])
    return parse_added_lines(worktree_diff)

def resolve_coverage_key(rel_path):
    rel_path = normalize_rel_path(rel_path)
    marker = '/src/main/java/'
    if marker in rel_path:
        package_key = rel_path.split(marker, 1)[1]
        if package_key in coverage_map:
            return package_key
    basename = rel_path.split('/')[-1]
    candidates = [key for key in coverage_map if key == basename or key.endswith('/' + basename)]
    if len(candidates) == 1:
        return candidates[0]
    if marker in rel_path:
        suffix = rel_path.split(marker, 1)[1]
        suffix_matches = [key for key in candidates if key.endswith(suffix)]
        if len(suffix_matches) == 1:
            return suffix_matches[0]
    return None

manifest_files = parse_manifest(change_manifest)
added_map = collect_manifest_backed_diffs(manifest_files) if manifest_files else {}
fallback_map = collect_fallback_diffs()
for file_path, lines in fallback_map.items():
    added_map.setdefault(file_path, set()).update(lines)

if not added_map:
    if fmt == "json":
        print(json.dumps({"status": "no_git_diff", "files": [], "manifest_used": bool(manifest_files),
                          "total_line_pct": None, "total_branch_pct": None}))
    else:
        message = "⚠️  无法获取有效 diff 数据，跳过增量覆盖率计算"
        if manifest_files:
            message += "（已优先尝试 change-manifest-phase2.md，并回退到 git diff HEAD）"
        print(message)
    sys.exit(0)

# ── 交叉比对 ──────────────────────────────────────────────────────────────
file_results = []
total_trackable_lines  = 0
total_covered_lines    = 0
total_branch_covered   = 0
total_branch_total     = 0

for java_file, added_lines in sorted(added_map.items()):
    if not added_lines:
        continue

    if should_exclude(java_file):
        continue

    coverage_key = resolve_coverage_key(java_file)
    file_cov = coverage_map.get(coverage_key, {}) if coverage_key else {}

    # 可跟踪行：在 JaCoCo XML 中出现的新增行
    added_line_list = sorted(added_lines)
    trackable = [l for l in added_line_list if l in file_cov]
    covered   = [l for l in trackable   if file_cov[l]["line_covered"]]

    # 分支统计（只统计 trackable 行上的分支）
    bc = sum(file_cov[l]["branch_covered"] for l in trackable)
    bm = sum(file_cov[l]["branch_missed"]  for l in trackable)
    bt = bc + bm

    diff_lines   = len(added_line_list)
    n_trackable  = len(trackable)
    n_covered    = len(covered)
    line_pct     = (n_covered / n_trackable * 100) if n_trackable > 0 else None

    total_trackable_lines += n_trackable
    total_covered_lines   += n_covered
    total_branch_covered  += bc
    total_branch_total    += bt

    file_results.append({
        "file":       java_file,
        "coverage_key": coverage_key,
        "diff_lines": diff_lines,
        "trackable":  n_trackable,
        "covered":    n_covered,
        "line_pct":   line_pct,
        "branch_covered": bc,
        "branch_total":   bt,
        "branch_pct": (bc / bt * 100) if bt > 0 else None,
    })

total_line_pct   = (total_covered_lines  / total_trackable_lines  * 100) \
                   if total_trackable_lines  > 0 else None
total_branch_pct = (total_branch_covered / total_branch_total * 100) \
                   if total_branch_total > 0 else None

# ── 输出 ─────────────────────────────────────────────────────────────────
if fmt == "json":
    print(json.dumps({
        "status": "ok",
        "manifest_used": bool(manifest_files),
        "files": file_results,
        "total_line_pct":   round(total_line_pct,   1) if total_line_pct   is not None else None,
        "total_branch_pct": round(total_branch_pct, 1) if total_branch_pct is not None else None,
        "total_trackable_lines":  total_trackable_lines,
        "total_covered_lines":    total_covered_lines,
        "total_branch_covered":   total_branch_covered,
        "total_branch_total":     total_branch_total,
    }, ensure_ascii=False, indent=2))
else:
    # 文本输出
    source_hint = "change-manifest-phase2.md + git diff" if manifest_files else "git diff"
    HEADER = "\n📈 精确增量覆盖率（%s vs %s）\n   覆盖率数据来源：JaCoCo 跨模块聚合 XML\n" % (source_hint, base_branch)
    print(HEADER)

    col_w = max((len(r["file"]) for r in file_results), default=20)
    header_fmt = "  {:<{w}}  {:>8}  {:>12}  {:>8}  {:>10}  {:>10}  {:>12}  {:>10}"
    row_fmt    = "  {:<{w}}  {:>8}  {:>12}  {:>8}  {:>10}  {:>10}  {:>12}  {:>10}"
    sep = "  " + "-" * (col_w + 8 + 12 + 8 + 10 + 10 + 12 + 10 + 14)

    print(header_fmt.format(
        "文件", "diff行", "可跟踪行", "已覆盖", "行覆盖率",
        "新增分支", "已覆盖分支", "分支覆盖率", w=col_w))
    print(sep)

    for r in file_results:
        lp = ("%.1f%%" % r["line_pct"])   if r["line_pct"]   is not None else "—"
        bp = ("%.1f%%" % r["branch_pct"]) if r["branch_pct"] is not None else "—"
        status_l = " ✅" if r["line_pct"]   is not None and r["line_pct"]   >= 80 else (
                   " ⚠️" if r["line_pct"]   is not None and r["line_pct"]   >= 60 else
                   " ❌" if r["line_pct"]   is not None else "")
        print(row_fmt.format(
            r["file"],
            r["diff_lines"],
            str(r["trackable"]) if r["trackable"] > 0 else "—",
            str(r["covered"])   if r["trackable"] > 0 else "—",
            lp + status_l,
            str(r["branch_total"])   if r["branch_total"] > 0 else "—",
            str(r["branch_covered"]) if r["branch_total"] > 0 else "—",
            bp,
            w=col_w))

    print(sep)

    # 合计行
    total_l_str = ("%.1f%%" % total_line_pct)   if total_line_pct   is not None else "无数据"
    total_b_str = ("%.1f%%" % total_branch_pct) if total_branch_pct is not None else "无数据"
    status_l = " ✅" if total_line_pct   is not None and total_line_pct   >= 80 else \
               " ❌" if total_line_pct   is not None else ""
    status_b = " ✅" if total_branch_pct is not None and total_branch_pct >= 80 else \
               " ❌" if total_branch_pct is not None else ""

    print(row_fmt.format(
        "合计",
        "",
        str(total_trackable_lines),
        str(total_covered_lines),
        total_l_str + status_l,
        str(total_branch_total),
        str(total_branch_covered),
        total_b_str + status_b,
        w=col_w))

    print()
    print("  增量行覆盖率：%s（%d/%d，目标 ≥ 80%%）%s" % (
        total_l_str, total_covered_lines, total_trackable_lines, status_l))
    print("  增量分支覆盖率：%s（%d/%d，目标 ≥ 80%%）%s" % (
        total_b_str, total_branch_covered, total_branch_total, status_b))
    print()
PY
}

# ─── 主流程 ──────────────────────────────────────────────────────────────────
main() {
    # 初始化缓存目录
    init_cache_dir

    log "========================================"
    log "🔬 跨模块 JaCoCo 增量覆盖率聚合"
    if [[ "$NO_CACHE" == "false" ]]; then
        log "   缓存目录：$CACHE_DIR"
    fi
    log "========================================"

    # Step 1: JDK
    log ""
    log "Step 1: 定位 JDK..."
    local java_home
    java_home=$(resolve_java_home)
    [[ -x "$java_home/bin/java" ]] || die "JDK 无效：$java_home"
    local java_version
    java_version=$("$java_home/bin/java" -version 2>&1 | head -1)
    info "JDK：$java_version @ $java_home"

    # Step 2: JaCoCo classpath
    log ""
    log "Step 2: 定位 JaCoCo jars..."
    local jacoco_cp
    jacoco_cp=$(resolve_jacoco_classpath)
    info "JaCoCo classpath：$(echo "$jacoco_cp" | tr ':' '\n' | while read -r j; do basename "$j"; done | paste -sd ',' -)"

    # Step 3: jacoco.exec
    log ""
    log "Step 3: 定位 jacoco.exec..."
    local exec_file
    exec_file=$(resolve_exec_file)
    local exec_size
    exec_size=$(du -h "$exec_file" 2>/dev/null | cut -f1)
    info "exec file: ${exec_file} (${exec_size})"

    # Step 4: 合并 class 目录
    log ""
    log "Step 4: 合并跨模块 class 目录..."
    local merged_classes
    merged_classes=$(merge_class_dirs)

    # Step 5: 生成 XML
    log ""
    log "Step 5: 生成跨模块 JaCoCo XML..."
    generate_jacoco_xml "$java_home" "$jacoco_cp" "$exec_file" "$merged_classes" "$OUTPUT_XML"

    # Step 6: 计算增量覆盖率
    log ""
    log "Step 6: 计算精确增量覆盖率..."
    compute_incremental_coverage "$OUTPUT_XML" "$BASE_BRANCH" "$PROJECT_ROOT" "$OUTPUT_FORMAT" "$CHANGE_MANIFEST"

    log ""
    log "========================================"
    log "✅ 完成"
    log "   XML 报告：$OUTPUT_XML"
    log "========================================"
}

main
