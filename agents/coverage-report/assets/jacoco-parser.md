# JaCoCo 解析逻辑

## Step 1：查找 JaCoCo 报告

```bash
find {project_root} -name "jacoco.xml" -path "*/target/*" | head -10
```

若找到多个（多模块项目），列出所有模块路径。

## Step 2：提取覆盖率数据

对每个 jacoco.xml：

```bash
# 行覆盖率
grep 'type="LINE"' {jacoco.xml} | \
  awk -F'"' '{covered+=$4; missed+=$6} END {printf "line_covered=%d line_missed=%d line_rate=%.1f%%\n", covered, missed, covered/(covered+missed)*100}'

# 分支覆盖率
grep 'type="BRANCH"' {jacoco.xml} | \
  awk -F'"' '{covered+=$4; missed+=$6} END {printf "branch_covered=%d branch_missed=%d branch_rate=%.1f%%\n", covered, missed, covered/(covered+missed)*100}'

# 方法覆盖率
grep 'type="METHOD"' {jacoco.xml} | \
  awk -F'"' '{covered+=$4; missed+=$6} END {printf "method_covered=%d method_missed=%d method_rate=%.1f%%\n", covered, missed, covered/(covered+missed)*100}'
```

## Step 3：若 JaCoCo 报告不存在

尝试触发 Maven 测试：
```bash
mvn test -pl {changed_modules} -Djacoco.skip=false 2>&1 | tail -20
```

若测试无法运行，输出：`N/A（未运行测试，请执行 mvn test 后重试）`

## Step 4：质量门判断

```
若 line_rate < {min_line_coverage}：
  → 结论：BELOW_THRESHOLD（行覆盖率 {line_rate} < {min_line_coverage}）
否则：
  → 结论：PASS
```

## Step 5：输出覆盖率摘要模板

```
## 测试覆盖率摘要

| 维度 | 覆盖数 | 总数 | 覆盖率 | 状态 |
|------|--------|------|--------|------|
| 行覆盖率 | {line_covered} | {line_covered+line_missed} | {line_rate} | {✅/⚠️} |
| 分支覆盖率 | {branch_covered} | {branch_covered+branch_missed} | {branch_rate} | {✅/⚠️} |
| 方法覆盖率 | {method_covered} | {method_covered+method_missed} | {method_rate} | {✅/⚠️} |

结论：{PASS / BELOW_THRESHOLD / N/A}
```
