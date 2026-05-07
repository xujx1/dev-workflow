---
description: 基于 test_file_list 执行测试、生成 JaCoCo 报告并输出阻塞分类与时延拆分。
argument-hint: [test_file_list 路径]
---

# /08-tdd-test-runner-agent — 执行单元测试并生成报告

直接调用 `tdd-test-runner-agent` 的斜杠命令入口。实际工作流在 `agents/tdd-test-runner/tdd-test-runner-agent.md`。

## 说明

清单驱动执行单元，基于 `test_file_list.md` 完成以下流程：

1. **前置校验**：校验清单格式并探测环境
2. **解析清单**：提取 feature_name、需求名、测试类全限定名列表
3. **执行测试**：`mvn test -Dtest=...` 收集 `jacoco.exec`
   - 若命中 `maven-surefire-plugin:2.20 + JUnit4 + Tests run: 0`，必须先用命令行覆盖 `-Dmaven-surefire-plugin.version=3.2.5` 重跑一次；**不得**修改仓库内 `pom.xml`
   - 若因沙箱无法写入本地 Maven 仓库（如 `~/.m2/repository`）失败，必须保持原清单范围不变，以完整权限重跑一次 `mvn test`
4. **生成报告**：执行 `jacoco:report` 与 `plugins/maven/jacoco_incremental_coverage.sh`，输出测试报告与阻塞分类
  - `jacoco:report` 只消费同一轮 `mvn test` 生成的 `jacoco.exec`，**不会**再次执行 JUnit 用例
  - 若为诊断补充生成覆盖率 XML / HTML，必须放到 `/tmp` 或缓存目录，**不得**落到 `req/.../test/_jacoco_feature/`

覆盖率判定以 `plugins/maven/jacoco_incremental_coverage.sh` 输出为准。

## 前置要求

- **必须**提供 `test_file_list.md` 路径（由 `testcode-gen-agent` 生成）
- 测试执行范围只来自清单，禁止猜测或扩跑
- JaCoCo 插件须已在目标模块 `pom.xml` 中配置

## 调用方式

直接调用 `agents/tdd-test-runner/tdd-test-runner-agent.md`。

**参数**：`$ARGUMENTS` — test_file_list Markdown 文件路径。

## 推荐用法

- `/08-tdd-test-runner-agent req/xxx/test_file_list.md`
  - 执行测试并生成覆盖率报告
- 覆盖率不达标时，配合 `/06-tdd-test-spec-agent task=supplement-coverage` 补充测试场景后重新执行

## 计时规范

遵循 `rules/common/timing-spec.md`。步骤定义：

| 步骤编号 | 步骤名称 |
|---------|---------|
| S1 | 前置校验（清单格式 + 环境探测） |
| S2 | 解析清单（提取 feature_name / 测试类列表） |
| S3 | 执行测试（mvn test + 收集 jacoco.exec） |
| S4 | 生成报告（jacoco:report + 增量覆盖率脚本） |
| S5 | 根因分类与回流决策 |

报表子章节：`### /08-tdd-test-runner-agent 耗时报表`。S3 重跑时备注注明原因。

