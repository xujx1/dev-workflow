# test_spec 文档格式规范

> 对齐 `agents/tdd-test-spec/assets/test_spec_template.md`
> 产出路径：`{feature_dir}/test_spec.md`

---

## 文档结构（硬约束）

`test_spec` 必须使用以下 8 个一级章节，禁止自定义成其他结构：

```markdown
# {需求名称} 测试规格

## 1. 需求分析
## 2. 需求实现分析
## 3. 需求测试分析
## 4. 测试用例
## 5. 测试数据准备
## 6. 测试环境
## 7. AI-SDD 测试执行
## 8. 附录
```

`## 4. 测试用例` 下必须包含以下 12 个子章节：

```markdown
### 4.1 正向场景
### 4.2 异常场景
### 4.3 边界场景
### 4.4 并发场景
### 4.5 幂等场景
### 4.6 状态流转场景
### 4.7 数据一致性场景
### 4.8 安全场景
### 4.9 性能场景
### 4.10 兼容性场景
### 4.11 配置场景
### 4.12 补偿/回滚场景
```

---

## 用例表格格式

测试用例表格统一使用以下列：

```markdown
| 用例ID | 场景描述 | 前置条件 | 输入 | 预期结果 |
|--------|----------|----------|------|----------|
| TC001 | 基本流程 | xxx | xxx | EX1 - 接口返回 success=true；EX2 - 表X的 status 字段为 CLOSED |
```

### 预期结果硬约束

- `预期结果` 列**必须**显式包含 `EX1`
- 多个校验点时必须按 `EX1`、`EX2`、`EX3` 递增编号
- 多个校验点使用分号分隔
- `EX1` 通常是接口返回/主结果校验
- `EX2` 及后续通常是 DB 状态、消息、副作用、日志、缓存等校验
- 禁止使用“结果正确”“状态正常”“数据一致”等模糊描述，必须写清字段、状态或行为

示例：

```markdown
| TC001 | 正常创建 | 仓库启用 | orderNo=O1 | EX1 - 接口返回 success=true；EX2 - 表order的 status 字段为 CREATED；EX3 - 表order_log新增1条创建日志 |
| TC102 | 参数校验失败 | 无 | orderNo为空 | EX1 - 返回参数校验错误码 ILLEGAL_PARAM；EX2 - 数据库无新增记录 |
```

---

## 生成要求

- 全流程 `skills/03-code-gen-tdd` 生成的 `test_spec`
- 单独调用 `agents/tdd-test-spec/tdd-test-spec-agent.md` 生成的 `test_spec`

以上两种方式的格式必须完全一致，统一遵循本文件与 `agents/tdd-test-spec/assets/test_spec_template.md`。
- 全流程场景中，`test_spec` **必须由** `tdd-test-spec-agent` 生成 / 补充；Skill / orchestrator 仅可调度、等待、校验落盘，禁止自行编写正文。
- 正式产物路径固定为 `{feature_dir}/test_spec.md`；`all_trace.md`、分析记录、过程摘要均不能替代正式 `test_spec`。
- 测试实现口径必须固定写成 **Java/JUnit**；允许写 `JUnit4 + Mockito`、standalone `MockMvc`，禁止写 `Spock`、`Groovy`、`Spec.groovy`、Spring 容器测试基类
- `mock-first` 的 HTTP 场景默认应描述为 standalone `MockMvc`，不应把 `@WebMvcTest` 作为首选口径
- 禁止在 `test_spec` 中出现“Spock 或 JUnit”“Groovy/Java 二选一”“沿用仓库现有测试风格”这类双轨描述

---

## 禁止项

- 禁止使用旧版“概述 / 场景覆盖矩阵 / 测试用例详情”三段式结构替代 8 章节结构
- 禁止省略 `## 4. 测试用例` 下的 12 类场景章节
- 禁止 `预期结果` 列不写 `EX1`
- 禁止只写模糊预期，不写字段级或行为级校验点
- 禁止出现与 `agents/tdd-test-spec/assets/test_spec_template.md` 冲突的第二套模板
- 禁止出现 `Spock`、`Groovy`、`Spec.groovy`，或任何 `Spock/JUnit` 二选一表述
