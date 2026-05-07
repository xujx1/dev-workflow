# Stage 03-code-gen-tdd — 输入示例

## 用户输入

```
/03-code-gen-tdd
需求空间：@req/当面开箱拍照签收
```

## 参数说明

| 参数 | 是否必填 | 说明 |
|---|---|---|
| `需求空间：@req/<需求名>` | 必填 | 指向 02-implementation-plan 阶段产出的需求目录 |

## 说明

Agent 自动完成（单应用完整 TDD 闭环）：

1. **环境预检**：检查 Maven 编译环境、测试依赖版本
2. **生成测试用例**：tdd-test-spec-agent 基于技术方案生成 `test_spec.md`（见 test_spec.md 示例）
3. **生成业务代码**：java-impl-agent 按 OpenSpec 任务清单逐类生成代码
4. **代码审查**：java-review-agent 生成 `code-review.md`（见 code-review.md 示例）
5. **生成单测代码**：testcode-gen-agent 基于 `test_spec.md` 生成测试类
6. **执行单测**：tdd-test-runner-agent 运行 JaCoCo，生成覆盖率报告（见 unit_test_report.md 示例）
7. **自动纠正**：覆盖率 < 80% 时自动重试（最多 2 轮）

## 自动纠正机制

| 阶段 | 纠正触发条件 | 处理方式 |
|---|---|---|
| 开发任务完整性 | OpenSpec 与 test_spec 双向比对发现遗漏 | 补充缺失任务 |
| 编译失败 | `mvn test-compile` 报错 | build-error-resolver 自动修复 |
| 单测未通过 | 测试用例 FAIL | 分析原因，修复代码或测试 |
| 覆盖率不足 | 增量行覆盖率 < 80% | 补充测试用例，重新执行 |

## 产出文件（存放在需求空间）

```
req/当面开箱拍照签收/
├── test_spec.md          ← 测试规格文档（见 test_spec.md 示例）
├── code-review.md        ← 代码审查报告（见 code-review.md 示例）
└── unit_test_report.md   ← 单测覆盖率报告（见 unit_test_report.md 示例）
```
