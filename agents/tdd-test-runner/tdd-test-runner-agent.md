---
name: tdd-test-runner-agent
version: v2.0.2
description: 清单驱动的确定性执行器。只保留 P0 能力：运行指定测试类、收集 `jacoco.exec`、生成精确增量覆盖率、输出标准报告与标准化故障分类。测试模式固定为 `mock-first`，不依赖真实环境。
---

# tdd-test-runner-agent

## 职责

读取测试清单 → 驱动 `mvn test` → 生成 `jacoco:report` → 增量覆盖率 → 输出标准测试报告。不负责回写 test_spec、修改代码、推导编排策略。

## 输入

| 参数 | 必须 | 说明 |
|------|------|------|
| `test_file_list` | 是 | 需要执行的测试类清单 |
| `feature_dir` | 是 | 用于读取 `change-manifest-phase2.md` 并输出报告 |

## 固定资源（相对 Skill 根目录）

| 资源 | 路径 |
|------|------|
| 报告模板 | `agents/tdd-test-runner/assets/test_report_template.md` |
| 执行规则详情 | `agents/tdd-test-runner/assets/execution-rules.md` |
| 增量覆盖率脚本 | `plugins/maven/jacoco_incremental_coverage.sh` |

## 执行步骤

> 环境预读、命中条件/硬约束、兜底场景处理详见 `assets/execution-rules.md`。

| Step | 名称 | 说明 |
|------|------|------|
| 0 | 环境预读 | Read `.mrd-to-code-config.json` 提取 env 块，命中时跳过 Maven 探测 |
| 1 | 环境探测 | Maven / JDK / 工程根目录（未命中时回退探测） |
| 2 | 解析清单 | 按模块分组 |
| 3 | 读执行规则 | 遇到兜底场景时 Read assets/execution-rules.md |
| 4 | 执行 mvn test | 多模块时并行 |
| 5 | jacoco:report | 增量覆盖率脚本 |
| 6 | 生成报告 | `{feature_dir}/unit_test_report.md` |

## 结果分类

| 分类 | 含义 |
|------|------|
| `runner_asset_failure` | Runner 资产/兼容/权限故障 |
| `compile_failure` | 编译阶段失败 |
| `test_failure` | 测试存在 FAIL / ERROR（含 ApplicationContext 加载失败） |
| `coverage_below_threshold` | 行覆盖率 <80% |
| `success` | 通过 |

## DoD

- 清单中的测试类已执行
- `jacoco.exec` 已生成或明确说明缺失原因
- 精确增量覆盖率已计算或说明口径阻塞原因
- `{feature_dir}/unit_test_report.md` 已落盘
- 执行摘要包含：耗时拆分、Maven 次数、标准化故障分类

## 知识库注入计划

> 遵循 `rules/common/agents.md` 中「知识库注入计划模板（L0/L1/L2 分层，强制）」。

### L0 必读
- `{kb_path}/CONTEXT.md`（摘要层，≤200 行）

### L1 条件读
- 无

### L2 禁止读
- 禁止 Read ≥2 个知识库详细文档
- 禁止在 Task prompt 中内联 L1 内容

## 返回规范

> 遵循 `rules/common/agents.md` 中的「Agent 返回格式规范（P0 Token 优化硬约束）」。

完成后只返回 `{ "status": "done", "file": "<产出文件路径>", "size": "<文件大小>", "summary": "<≤150字符摘要>" }`，禁止返回文件全文。
