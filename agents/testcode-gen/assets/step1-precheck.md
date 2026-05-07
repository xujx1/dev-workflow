# Step 1 前置校验（P0）

## 目标

在生成测试代码前，用最少动作确认输入、规则、工程环境和 `basePackage`。

> ⚠️ **执行顺序**：本步骤之前必须先执行 `step0-contract-scan.md`（API 契约扫描），该步骤产出的「API 契约摘要」将在本步骤中作为规则摘要的一部分被复用。

## ⚠️ 路径解析规则（必须遵守）

**关键区分**：本文件属于 Skill 分发的固定资源，**必须相对 `$HOME/.claude/plugins/dev-workflow` 解析**。

```
skill_root = ~/.claude/plugins/dev-workflow/  （或插件目录）
project_root = 当前业务工程根目录（$PWD）
feature_dir = 需求目录（如 req/591-xxx/）

规则文件路径示例：
  ✅ 正确：$HOME/.claude/plugins/dev-workflow/rules/test/test_index.md
     → ~/.claude/plugins/dev-workflow/rules/test/test_index.md

  ❌ 错误：{project_root}/{feature_dir}/rules/test/test_index.md
     → ~/code/xxx/req/591-xxx/rules/test/test_index.md（此路径不存在）

Step 文件路径示例：
  ✅ 正确：$HOME/.claude/plugins/dev-workflow/agents/testcode-gen/assets/step1-precheck.md
     → ~/.claude/plugins/dev-workflow/agents/testcode-gen/assets/step1-precheck.md

  ❌ 错误：{project_root}/{feature_dir}/agents/testcode-gen/assets/step1-precheck.md
     → ~/code/xxx/req/591-xxx/agents/testcode-gen/assets/step1-precheck.md（此路径不存在）
```

**判断标准**：
- 裸 `rules/...` 路径 → 相对 `$HOME/.claude/plugins/dev-workflow`
- 裸 `agents/...` 路径 → 相对 `$HOME/.claude/plugins/dev-workflow`
- 包含 `src/`、`pom.xml`、`app-knowledge-base/` → 相对 `project_root`
- 包含 `{feature_dir}` → 相对 `project_root`

## ⚠️ 环境预检门（Step 1 第零动作，读任何其他文件前执行）

**立即** Read `{project_root}/.mrd-to-code-config.json`，检查 `env` 字段：

- 若同时满足以下三个条件：
  - `env.env_confirmed = true`
  - `env.test_deps_junit5` 字段存在（`true` 或 `false`）
  - `env.test_deps_mockito` 字段存在
  - 则：将以下值记录为本 Step 输出：
    - `maven_path` = `env.maven_path`
    - `junit_version` = `env.test_deps_junit5 == false` → **JUnit4**；`true` → JUnit5
    - `mockito_available` = `env.test_deps_mockito`
  - **绝对禁止（即使"顺手确认"也不允许）**：
    - `grep pom.xml`、`cat pom.xml`、读取 pom.xml 文件的任何操作
    - `mvn -v`、`mvn dependency:list`、任何 maven 命令
    - `find .../test`、`ls src/test`、查找 test 目录的任何命令
  - **直接执行**：必做项第 1 步 → 第 2 步 → 第 3 步 → 第 4 步 → **跳过第 5 步** → 第 6 步 → 第 7 步
- 若文件不存在或 `env` 字段缺失 → 继续正常执行下方必做项（含第 5 步回退探测）

---

## 必做项

1. 必须提供 `test_spec`
2. **Step 0 契约摘要已就绪**
   - 确认 `step0-contract-scan.md` 已完成执行
   - 内存中已存在「API 契约摘要」（方法签名、异常映射、Mockito stub 策略、Mock 依赖）
   - 将契约摘要中的关键信息纳入规则摘要
3. 并行读取（以下路径均相对 `$HOME/.claude/plugins/dev-workflow`）：
   - `rules/test/test_index.md`
   - `rules/test/01-test-first.md`
   - `rules/test/05-code-gen-rules.md`
   - `rules/test/10-validation-checklists.md`
   - 用户提供的 `test_spec`（相对 `project_root`）
4. 提炼一份简短规则摘要（含 API 契约摘要），后续步骤直接复用
5. **环境回退探测（仅当环境预检门未命中时执行）**：
   - 读取 `{feature_dir}/execution-state.md`：
     - 若 `env_confirmed=true` → **跳过** Maven/JDK 探测，直接使用 `maven_cmd` / `maven_settings` 字段值
     - 若 `test_deps_confirmed=true` → **跳过** JUnit4/Mockito 依赖检测
     - 若缺失以上任一字段 → **执行一次**最小探测（`mvn -v`），不得重复执行相同命令
6. 确认 `basePackage`
7. 明确本轮每个产物的目标落盘目录与对应 `package` 声明

## `basePackage` 来源

按优先级：

1. `test_spec` 明确给出
2. `TddTestApplication.java`
3. 最顶层 `@SpringBootApplication` 包名

若仍无法确认，立即停止。

## `package` 声明预校验

- 测试类目标目录：`src/test/java/{basePackage}/tdd/component/`
- 必要支撑类：必须先明确其目标子目录，再反推唯一 `package`
- 生成前必须先写清楚"目录 -> package"映射，禁止先生成代码再猜包名
- 若某个文件的目标目录尚不明确，立即停止，而不是写一个可能错误的 `package`

## 中断条件

- 缺少 `test_spec`
- Maven / JDK 不可用（`env_confirmed=true` 时跳过此项检测，不触发中断）
- `basePackage` 无法确认
- 当前工程不是 Maven 或 Gradle 工程
