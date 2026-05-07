# 测试报告

## 1. 基本信息

| 项目 | 内容 |
|------|------|
| 项目名称 | |
| 需求名称 | |
| 测试分支 | |
| 测试日期 | |
| 测试文件清单 | |
| 变更清单 | |

---

## 2. 执行摘要

| 指标 | 数值 |
|------|------|
| 测试类数量 | |
| 测试用例总数 | |
| 通过（PASS） | |
| 失败（FAIL） | |
| 错误（ERROR） | |
| 跳过（SKIP） | |
| 通过率 | |
| 总耗时 | |
| Maven 次数 | |
| 根因分类 | `success / runner_asset_failure / compile_failure / test_failure / coverage_below_threshold` |
| `mvn test` 退出码 | |
| 权限兜底 | | `not-needed` / `sandbox-blocked -> full-permission rerun` |
| Surefire 命令行覆盖 | | 例如 `-Dmaven-surefire-plugin.version=3.2.5` / `not-needed` |

### 2.1 时延拆分

| 步骤 | 耗时 | 备注 |
|------|------|------|
| `mvn test` | | |
| `jacoco:report` | | |
| 增量脚本 | | |
| 覆盖率脚本模式 | | `cache / --no-cache` |

---

## 3. 覆盖率

### 3.1 全量覆盖率（仅供参考）

| 维度 | 覆盖率 |
|------|--------|
| 行覆盖率 | |
| 分支覆盖率 | |
| 方法覆盖率 | |
| 类覆盖率 | |

> 说明：本节必须来自与本轮 `mvn test` 同一份 `jacoco.exec` 的后处理结果。`jacoco:report` 只生成报告，**不会**再次执行 JUnit 用例。

### 3.2 精确增量覆盖率

| 维度 | 实际覆盖率 | 目标值 | 是否达标 |
|------|------------|--------|----------|
| 增量行覆盖率 | | ≥ 80% | |
| 增量分支覆盖率 | | 参考 | |

> 说明：精确增量覆盖率必须来自 `jacoco.exec` 与 `change-manifest-phase2.md` / `git diff` 的交叉结果。

> 落盘约束：`req/.../test/` 目录只保留 Markdown 测试报告等正式产物；补充 JaCoCo XML / HTML 若非 Maven `target/` 稳定构建产物，必须放到 `/tmp` 或缓存目录，**不得**落到 `req/.../test/_jacoco_feature/`。

### 3.3 覆盖率诊断摘要

| 项 | 内容 |
|----|------|
| 覆盖率脚本首轮结果 | |
| 是否触发兜底 | |
| 兜底动作 | |
| 最终覆盖率口径 | |

---

## 4. 失败与阻塞分类

| 类型 | 说明 | 结论 |
|------|------|------|
| `runner_asset_failure` | 覆盖率脚本、缓存、classpath、参数契约、沙箱权限故障，或 Surefire/JUnit4 兼容问题 | 继续 / 中断 |
| `compile_failure` | 测试编译失败 / 依赖缺失 / 非 Surefire 兼容类原因导致的执行前失败 | 继续 / 中断 |
| `test_failure` | 断言失败 / ERROR / 启动失败；即使 `testFailureIgnore=true` 导致 `mvn` 为 `exit 0` 仍算失败；`Failed to load ApplicationContext` / Nacos `localhost:8848` 失败也归此类 | 继续 / 中断 |
| `coverage_below_threshold` | 用例全绿但精确增量覆盖率不足 | 继续 / 中断 |

---

## 5. 用例明细

### 5.1 失败用例

| # | 用例名称 | 所属测试类 | 关联 `test_spec` 用例ID | 摘要 |
|---|----------|------------|------------------------|------|
| 1 | | | | |

### 5.2 跳过用例

| # | 用例名称 | 原因 |
|---|----------|------|
| 1 | | |

### 5.3 关键异常摘要

| # | 类型 | 摘要 |
|---|------|------|
| 1 | | |

---

## 6. 未覆盖分析

| 文件/方法 | 未覆盖原因 | 建议 |
|-----------|-----------|------|
| | | |

---

## 7. 结论

**结论**：

> 若 `mvn test` 为 `exit 0`，但 Surefire/Failsafe 报告存在 FAIL / ERROR，最终仍必须写为 `test_failure`，不得写成 `success`。

**报告路径**：

**建议回流链**：

**下一步注意事项**：
