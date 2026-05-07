# generate-tdd-test-spec 执行规则详情

> 本文件由 `tdd-test-spec-agent.md` 骨架按需 Read。

## P0 能力规则

### 1. 最小读取集

默认读取：`tech-design`、可选 `PRD/MRD`、可选 `change-manifest-phase2.md`、`rules/test/test_index.md`、`rules/test/01-test-first.md`、`rules/test/04-spec-format.md`、`agents/tdd-test-spec/assets/test_spec_template.md`

> 除非 tech-design 明确涉及特殊场景，禁止追加读取大批量知识库或长规则分片。

### 2. 生成与落盘方式

- `task=generate`：必须先在内存中完成完整终稿组装与自检，再**单次落盘**
- 禁止先写半成品，再二次覆盖同一路径
- Step 3、3.5、4、5、6 补齐动作默认在落盘前完成
- `task=supplement-coverage` / `task=review-openspec` 允许增量追加

### 3. 输出契约

文件路径：`{feature_dir}/test_spec.md`

必须包含章节：
1. `## 1. 需求分析`
2. `## 2. 需求实现分析`
3. `## 3. 需求测试分析`（含 `## 3.4 覆盖率意图清单`）
4. `## 4. 测试用例`
5. `## 5. 测试数据准备`
6. `## 6. 测试环境`（固定为 mock-first 声明）
7. `## 7. AI-SDD 测试执行`
8. `## 8. 附录`

### 4. 用例最小语义

- 列固定：`用例ID | 场景描述 | 前置条件 | 输入 | 预期结果`
- `前置条件` 使用 `M{N}` 语义：`M{N}-[MOCK]:...` / `M{N}-[配置]:...`
- `预期结果` 使用 `EX{N}` 语义
- 不适用场景使用 `N/A：本需求暂无此类场景`

### 4.5 coverage intent 校验

若提供 `change-manifest-phase2.md`，必须核对：
- 新增/修改入口是否有主路径场景
- 新增/修改分支是否有正反场景
- 新增消息字段/持久化字段/映射字段是否有断言点
- 涉及灰度/开关/白名单是否有配置场景

### 4.6 变更方法全覆盖分析（task=generate 时必须执行）

**步骤 1**：从 change-manifest 或技术方案提取所有变更方法（新增+修改），识别访问修饰符和方法类型

**步骤 2**：构建调用链关系，在 `### 2.3 被测入口` 补充调用链信息

**步骤 3**：测试入口策略标注
- 优先：通过公共入口方法测试
- 仅当无法通过公共入口触发时才使用反射
- 用例标注 `入口类型: 公共入口` 或 `入口类型: 反射调用`

**步骤 4**：在 test_spec 追加 `## 3.4 覆盖率意图清单`（位于 3.3 之后），每个变更方法至少映射 1 个正向用例 + 1 个边界用例

**步骤 5**：DoD 校验：所有变更方法已映射用例、反射调用已标注原因

### 4.7 测试模式

测试模式固定为 **mock-first**：JUnit4 + Mockito、standalone MockMvc、Mock DB/Redis/RPC/MQ/HTTP。

> 无论仓库历史风格，输出口径固定为 **Java/JUnit**，禁止 Spock/Groovy。

### 5. supplement-coverage 规则

- 输入必须包含：已存在 test_spec + unit_test_report + change-manifest
- 只在 `## 4. 测试用例` 下追加缺口场景
- 允许在文末追加 `## 📝 Coverage Round 补充`
- 禁止重写整份 spec

### 6. review-openspec 规则

- 仅在 OpenSpec 已存在时使用
- 只允许在现有 spec 末尾追加结论或补充
- 禁止重写整份 spec

## 禁止项

- task=generate 时中途落盘半成品 test_spec
- 禁止读取 `src/main/java/**`、`src/test/**`、git diff、编译日志
- 禁止用实现代码反推需求
- 禁止为凑满场景生成空洞用例
- 禁止输出精确增量覆盖率数字作为验收结论
- 禁止写 `Spock`、`Groovy`、`Spec.groovy`
- 禁止写"Spock 或 JUnit""Groovy 或 Java"等二选一描述
