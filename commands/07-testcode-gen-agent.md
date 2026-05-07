---
description: 基于 test_spec 生成窄职责测试代码：真实入口、边界 Mock、DataFactory、test_file_list 与窄范围 test-compile gate。
argument-hint: [test_spec 路径]
---

# /07-testcode-gen-agent — 生成单元测试代码

直接调用 `testcode-gen-agent` 的斜杠命令入口。实际工作流在 `agents/testcode-gen/testcode-gen-agent.md`。

## 说明

基于 `test_spec` 完成以下最小流程：

1. **前置检测**：探测 Maven、JDK、工程类型并确认 `basePackage`
2. **入口分析**：定位真实入口（HTTP / Dubbo / MQ）
3. **代码生成**：先锁定目标目录与 `package`，再生成测试类、DataFactory、必要支撑类
4. **构建修复**：模块级窄范围 `test-compile`（最多 3 轮）
5. **文件清单**：输出 `test_file_list.md` 供 `tdd-test-runner-agent` 消费

## 前置要求

- **必须**提供 `test_spec` 文件路径，禁止猜默认路径
- 仅生成 Java 测试代码，目标目录必须是 `src/test/java/.../tdd/`
- 每个新增 `.java` 文件的 `package` 声明必须与真实落盘目录一致
- 只 Mock 外部系统边界，内部组件禁止 `@MockBean`

## 调用方式

直接调用 `agents/testcode-gen/testcode-gen-agent.md`。

**参数**：`$ARGUMENTS` — test_spec 文件路径。

## 推荐用法

- `/07-testcode-gen-agent req/xxx/test_spec.md`
  - 自动探测环境并生成测试代码

## 计时规范

遵循 `rules/common/timing-spec.md`。步骤定义：

| 步骤编号 | 步骤名称 |
|---------|---------|
| S1 | 前置检测（Maven / JDK / 工程类型 / basePackage） |
| S2 | 入口分析（HTTP / Dubbo / MQ 真实入口定位） |
| S3 | 代码生成（测试类 / DataFactory / 支撑类） |
| S4 | 构建修复（模块级 test-compile，最多 3 轮） |
| S5 | 输出 test_file_list 清单文件 |

报表子章节：`### /07-testcode-gen-agent 耗时报表`。S4 多轮修复时备注注明轮次。

