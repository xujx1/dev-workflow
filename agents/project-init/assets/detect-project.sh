#!/bin/bash
# Step 3 — 检测项目结构与测试依赖

# 项目结构（多模块）
if grep -q '<modules>' pom.xml 2>/dev/null; then
  project_modules=$(grep -oP '(?<=<module>)[^<]+' pom.xml | tr '\n' ',' | sed 's/,$//')
else
  project_modules=""
fi
project_groupId=$(grep -oP '(?<=<groupId>)[^<]+' pom.xml | head -1)
project_artifactId=$(grep -oP '(?<=<artifactId>)[^<]+' pom.xml | head -1)

# 测试依赖
grep -q 'junit-jupiter\|junit-platform\|junit5\|org.junit.jupiter' pom.xml 2>/dev/null \
  && junit5=true || junit5=false
grep -q 'mockito' pom.xml 2>/dev/null && mockito=true || mockito=false

# 测试依赖扫描说明
# | 检测结果 | 含义 | 后续行动 |
# |----------|------|---------|
# | junit5=true | 项目已声明 JUnit5 | 直接就绪 |
# | junit5=false | 未找到 JUnit5 | 需人工确认：可能 JUnit4；写入 test_deps_junit_version=4 |
# | mockito=true | Mockito 已声明 | 就绪 |
# | mockito=false | 未找到 Mockito | 提示：测试无法使用 Mock，建议补充依赖 |
#
# JUnit4 vs JUnit5 关键区别（影响 Phase 4 代码生成）：
# - JUnit4：@RunWith(MockitoJUnitRunner.class) + @Test（org.junit）
# - JUnit5：@ExtendWith(MockitoExtension.class) + @Test（org.junit.jupiter.api）
# - 判断依据：pom.xml 中 junit:junit artifactId → JUnit4；junit-jupiter → JUnit5
