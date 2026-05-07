# Step 4 窄编译与 JaCoCo 就绪（P0）

## ⚡ 环境预读（最高优先级，执行任何编译命令前完成）

**第一个动作**：Read `{project_root}/.mrd-to-code-config.json`，提取 `env.maven_path`：

- 若 `env.env_confirmed = true` 且 `env.maven_path` 非空：
  - 将本步骤所有 `mvn` 替换为 `{env.maven_path}`（绝对路径，如 `/Users/admin/maven/maven/3.9.12/bin/mvn`）
  - **绝对禁止**：`find / -name "mvn"` / `ls /usr/bin/mvn` / `which mvn` / `ls $HOME/bin/mvn` / 任何 mvn 路径探测命令
- 若 `env.maven_path` 为空或文件不存在：
  - 执行一次 `which mvn` 确认路径，不得重复执行

---

## 目标

在不跑全量测试的前提下，让本次新增测试代码尽快通过最小编译门，并保证后续 Runner 能拿到覆盖率数据。

## 编译策略

### 总体原则：先增量，失败后全量

- 使用 `-Dmaven.compiler.includes` 将编译范围**精确限定**到本轮新增/修改的测试类
- 编译失败时，先判断失败文件是否属于本轮生成列表：历史遗留文件失败视为噪音，不阻断本次任务
- 仅当本轮生成文件出现跨文件依赖问题（连续 2 轮不同文件失败）时，才退化为全量模块 test-compile（不带 `-am`）
- 若本轮生成多个测试类，先汇总全部文件名，一次性传入 `-Dmaven.compiler.includes`
- 禁止"每生成一个测试类就单独跑一次 `test-compile`"的低效模式
- ❌ 严禁 `mvn -pl {模块} -am test-compile`（触发上游全量编译）

### 增量编译命令

> ⚠️ **关键**：`-Dincludes` 是 Surefire 测试执行参数，对编译阶段**无效**。限制编译范围必须使用 `-Dmaven.compiler.includes`。

**第一轮编译（全部新增测试类）**：

```bash
mvn -pl {被测模块} test-compile \
  -Dmaven.compiler.includes="**/{TestClass1}.java,**/{TestClass2}.java"
```

其中：
- `{TestClass1}.java` 等为本轮所有新生成/修改的测试类文件名
- 示例：`-Dmaven.compiler.includes="**/ElectronicSheetServiceTest.java"`
- 支撑类与测试类一并列入 `includes`，一次性编译

**修复后增量编译（仅失败文件）**：

```bash
mvn -pl {被测模块} test-compile \
  -Dmaven.compiler.includes="**/{修复后的失败文件名}.java"
```

### 历史遗留错误识别（不阻断本次任务）

编译失败时，**首先判断失败文件是否属于本轮生成列表**：

- **失败文件不在本轮生成列表中**（如 `SpareJobTest.java`、`LegacyHandlerTest.java` 等历史类）：
  - 视为**历史噪音**，**不尝试修复**，**不升级为全量编译**
  - 在输出报告中注明："检测到历史遗留编译错误（非本轮产物），已忽略"
  - 本次任务视为**编译通过**，继续后续步骤
- **失败文件在本轮生成列表中**：正常执行修复流程（最多 3 轮）

### 退化策略（严格限制）

**禁止**在以下情况升级为全量编译：
- 历史遗留文件编译失败（已由上方规则处理）

仅当以下**所有条件同时满足**时，才可退化为全量模块编译：
- 失败文件属于本轮生成列表
- 增量编译连续 2 轮失败且每次失败文件不同（存在跨文件依赖）
- 失败原因明确是模块间依赖缺失（错误信息含 `package does not exist` 等）

退化命令（限用 1 次，不带 `-am`）：

```bash
mvn -pl {被测模块} test-compile \
  -Dmaven.compiler.includes="**/{本轮所有生成文件}.java"
```

> ❌ **禁止**：`mvn -pl {被测模块} -am test-compile`（带 `-am` 会编译所有上游模块及其全量测试类，触发大量历史错误）

## 自动修复边界

允许自动修复：

- import / 包路径错误
- 方法签名不匹配
- 外部边界 Mock / Spy 相关缺失 Bean

必须立即中断：

- `${artifactId}`
- Maven 私服或依赖仓库不可达
- 与当前需求无关的分支噪音

## 重试上限

- 编译修复最多 3 轮
- 连续 2 轮无进展立即停止
- 增量编译阶段：每一轮仅编译失败文件集合，不重跑已通过文件
- 退化全量编译后：仅允许 1 轮，修复后直接退出或停止

## JaCoCo 职责

本阶段只做配置级验证：

- 检查 `jacoco-maven-plugin` 是否存在
- 必要时补全最小配置
- 再跑一次面向本轮全部测试产物集合的 `test-compile`

禁止在本阶段执行：

- `mvn test`
- `jacoco:report`
- 覆盖率分析
