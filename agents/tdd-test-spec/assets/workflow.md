# generate-tdd-test-spec P0 工作流

## 目标

用最少输入生成一份可被 `testcode-gen-agent` 稳定消费的 `test_spec`；在 `## 3. 需求测试分析` 中写明 **精确增量行覆盖率 ≥80%** 编排目标，覆盖率不足时**优先**在本 spec 局部补充（`supplement-coverage`），再进入生成/跑测，避免反复只改测码。

## Step 1：读取最小输入集

必须读取：

- 用户提供的 `tech-design`
- `$HOME/.claude/plugins/dev-workflow/rules/test/test_index.md`
- `$HOME/.claude/plugins/dev-workflow/rules/test/01-test-first.md`
- `$HOME/.claude/plugins/dev-workflow/rules/test/04-spec-format.md`
- `$HOME/.claude/plugins/dev-workflow/agents/tdd-test-spec/assets/test_spec_template.md`

可选读取：

- `PRD/MRD`

默认不做：

- 扫描实现代码
- 扫描测试代码
- 全量读取测试知识库
- 读取编译日志

## Step 2：提炼最小测试事实

从 `tech-design` 中只提炼以下事实：

- 被测入口类型：HTTP / Dubbo / MQ / 其他
- 被测主流程
- 关键异常路径
- 明显边界条件
- 外部依赖
- 配置项或开关
- 是否涉及 DB、状态流转、幂等、补偿

如果 `PRD/MRD` 存在，只补充业务背景和用户故事，不得覆盖 `tech-design` 的实现边界。

## Step 2.5：固定测试实现口径

在生成任何 `test_spec` 文案前，先固定以下约束：

- 测试实现只能写成 **Java/JUnit**
- HTTP 场景优先 standalone `MockMvc`（`MockMvcBuilders.standaloneSetup(controller)`），不把 `@WebMvcTest` 作为默认首选
- 非 HTTP 场景使用 `MockitoAnnotations.initMocks(this)` 或 `@RunWith(MockitoJUnitRunner.class)`（仅仓库已存在 mockito-core 时）
- 禁止写 `Spock`、`Groovy`、`Spec.groovy`
- 禁止写"Spock 或 JUnit""Groovy/Java 二选一""沿用仓库既有测试风格"这类双轨描述

## Step 3：生成 P0 场景

### 必须生成

- `4.1 正向场景`
- `4.2 异常场景`
- `4.3 边界场景`

### 按需生成

仅当 `tech-design` 明确涉及时，才在对应章节填写具体用例：

- `4.4 并发场景`
- `4.5 幂等场景`
- `4.6 状态流转场景`
- `4.7 数据一致性场景`
- `4.8 安全场景`
- `4.9 性能场景`
- `4.10 兼容性场景`
- `4.11 配置场景`
- `4.12 补偿/回滚场景`

若不涉及，统一写：

```markdown
| 用例ID | 场景描述 | 前置条件 | 输入 | 预期结果 |
|--------|----------|----------|------|----------|
| N/A | 本需求暂无此类场景 | - | - | EX1 - 无需补充 |
```

## Step 3.5：做 coverage intent 校验

若输入里带了 `change-manifest-phase2.md` 或等价变更摘要，在落盘前必须再做一次"场景映射完整性"检查：

- 新增 / 修改入口：是否至少有 1 条主路径场景
- 新增 / 修改分支：是否同时有命中 / 不命中、成功 / 失败或正反场景
- 新增消息字段、持久化字段、映射字段：是否有明确断言点，而不只是"调用成功"
- 灰度、开关、白名单、兼容逻辑：是否有独立配置场景

若发现缺口：

1. 优先补到现有 `4.x` 小节
2. 不要把缺口留到 Phase 5 再靠 Runner 反复试错
3. 仍然禁止伪造"预计覆盖率 85%"之类数字

## Step 4：终稿组装后再单次落盘

- `task=generate` 时，必须先在内存中完成整份 `test_spec` 的章节填充、coverage intent 校验和格式自检
- 只有确认终稿满足模板与结构约束后，才允许把 `test_spec` 一次性写入目标路径
- 禁止先落盘半成品，再对同一路径执行第二次整篇覆盖
- 若发现缺口，优先回到内存中的终稿继续修补，而不是依赖中途写文件

## Step 5：写出机器可消费字段

每条具体用例都必须满足：

- `前置条件` 使用 `M{N}` 编号
- `预期结果` 使用 `EX{N}` 编号
- 场景描述是可落到测试方法的短句
- 输入字段保留关键业务参数，不写大段自然语言

推荐优先表达：

- 入口是什么
- 依赖怎么桩掉
- DB / MQ / 状态断言看什么

## Step 6：局部格式自检

只检查以下事项：

- 8 个一级章节是否存在
- `## 4. 测试用例` 下 12 个子章节是否存在
- 用例表格列是否完整
- 是否出现 `M{N}` 与 `EX{N}`
- 是否明确写成 `Java/JUnit`，且未出现 `Spock` / `Groovy` / `Spec.groovy`
- 若提供变更清单，关键变更点是否都已映射到场景

发现问题时优先在最终落盘前做局部修补；`task=generate` 禁止因为自检而中途写文件后再重写整篇。

## `task=supplement-coverage`

输入必须包含：

- 已存在的 `test_spec`
- `unit_test_report`
- `change-manifest-phase2.md` 或缺口摘要

补充步骤：

1. 从覆盖率报告中找出未覆盖方法、分支或文件
2. 只在现有 `## 4. 测试用例` 对应章节追加用例
3. 在文末追加 `## 📝 Coverage Round 补充`
4. 重新检查新增用例是否具备 `M/EX`

禁止：

- 重新生成整份 spec
- 新增无关章节
- 为 manifest 外的文件补场景

## `task=review-openspec`

只做边界互审：

- 若发现测试侧缺口，向 `test_spec` 末尾追加 `## 📝 Round 2 补充（技术方案边界补充）`
- 若无需改动，追加 `## ✅ Round 2 确认：无需修改`

禁止重写既有章节。
