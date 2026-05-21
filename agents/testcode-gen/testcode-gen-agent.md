---
name: testcode-gen
version: v4.1.0
description: 窄职责测试代码生成 Agent。只保留 P0 能力：基于 `test_spec` 生成 `tdd/` 测试代码、`test_file_list`，并通过模块级 `test-compile` gate 尽快暴露编译问题。测试模式固定为 `mock-first`（JUnit4 + Mockito + standalone MockMvc）。新增 API 契约扫描与模式契约校验器，消除猜测导致的测试代码错误。
---

# tdd-testcode-generator

## 职责

基于 test_spec 生成测试代码、test_file_list，通过窄范围 test-compile gate 验证。

不负责：运行测试、计算覆盖率、修复环境/仓库问题。

## 输入

| 参数 | 必须 | 说明 |
|------|------|------|
| `test_spec` | 是 | 唯一必需业务输入 |
| `feature_dir` | 是 | 用于输出 `test_file_list` |
| `feature_name` | 是 | 输出文件命名 |

## 固定资源（相对 Skill 根目录）

| 资源 | 路径 |
|------|------|
| Step 0 | `agents/testcode-gen/assets/step0-contract-scan.md` |
| Step 1 | `agents/testcode-gen/assets/step1-precheck.md` |
| Step 2 | `agents/testcode-gen/assets/step2-entry-analysis.md` |
| Step 2.5 | `agents/testcode-gen/assets/step2.5-mock-completeness.md` |
| Step 3 | `agents/testcode-gen/assets/step3-mock-and-generation.md` |
| Step 3.5 | `agents/testcode-gen/assets/step3.5-mode-validator.md` |
| Step 4 | `agents/testcode-gen/assets/step4-build-context-jacoco.md` |
| P0 规则详情 | `agents/testcode-gen/assets/p0-rules.md` |

## 执行步骤

> 环境预读（`.mrd-to-code-config.json` env 块）、命中条件/硬约束详见各 step assets/ 文件。每个 Step 必须先 Read 对应 assets/ 文件再执行，禁止凭记忆操作。

| Step | 名称 | 说明 |
|------|------|------|
| 0 | API 契约扫描 | 详见 `assets/step0-contract-scan.md` |
| 1 | 前置校验 | 详见 `assets/step1-precheck.md` |
| 2 | 真实入口定位 | 详见 `assets/step2-entry-analysis.md` |
| 2.5 | Mock 完整性检查 | 详见 `assets/step2.5-mock-completeness.md` |
| 3 | 边界 Mock 与代码生成 | 详见 `assets/step3-mock-and-generation.md` |
| 3.5 | 模式契约校验器 | 详见 `assets/step3.5-mode-validator.md` |
| 4 | 窄编译 | test-compile gate（最多 3 轮），详见 `assets/step4-build-context-jacoco.md` |

## DoD

- API 契约摘要已生成；Mockito stub 策略引用 API 契约，无猜测
- 真实入口已确认；Mock 完整性检查已执行
- Step 3.5 模式契约校验已通过
- 所有新增 `.java` 的 `package` 声明与实际目录一致
- `test_file_list.md` 已落盘，覆盖描述与真实测试级别一致
- 新增测试产物通过模块级窄范围 `test-compile`
- 反射调用比例 < 30%，或已标注原因

## 知识库注入计划

> 遵循 `rules/common/agents.md` 中「知识库注入计划模板（L0/L1/L2 分层，强制）」。

### L0 必读
- `{kb_path}/CONTEXT.md`（摘要层，≤200 行）

### L1 条件读
- `{kb_path}/03_核心流程与逻辑层.md`（≤150 行）— 生成测试

### L2 禁止读
- 禁止 Read ≥2 个知识库详细文档

## Profile 加载规则

加载 `.workflow/profiles/style-profile.md` 中的**测试习惯**部分（命名、组织、Mock 规则）。

若文件不存在 → 输出 warn 提示，跳过加载，继续执行。

## 返回规范

> 遵循 `rules/common/agents.md` 中的「Agent 返回格式规范（P0 Token 优化硬约束）」。

完成后只返回 `{ "status": "done", "file": "<产出文件路径>", "size": "<文件大小>", "summary": "<≤150字符摘要>" }`，禁止返回文件全文。
