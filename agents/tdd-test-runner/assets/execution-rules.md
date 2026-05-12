# tdd-test-runner 执行规则详情

> 本文件由 `tdd-test-runner-agent.md` 骨架按需 Read。


## 2.0 多模块并行执行策略（必须）

当测试文件清单中的测试类分布在**多个 Maven 模块**时，**必须启用并行执行**。

**步骤 1：按模块分组**
- 解析 `test_file_list` 中每个测试类的 Maven 模块归属
- 形成 `{module} → [test classes]` 映射

**步骤 2：并行执行 `mvn test`**
```bash
mvn test -Dtest=TestA,TestB -pl module1 -DfailIfNoTests=false &
PID1=$!
mvn test -Dtest=TestC,TestD -pl module2 -DfailIfNoTests=false &
PID2=$!
wait $PID1 $PID2
```

**步骤 3：执行 `jacoco:report`**

> ⚠️ **首选命令（直接用，不做变体探索）**：

```bash
cd {project_root}/{module_path} && {mvn_path} org.jacoco:jacoco-maven-plugin:0.8.12:report 2>&1 | grep -E "BUILD|Loading|Analyzed|report|ERROR|jacoco" | head -20
```

- `{mvn_path}` 取 `env.maven_path`（来自 `.mrd-to-code-config.json`），未读取时用 `mvn`
- `cd` 进子模块目录直接执行，**不使用 `-pl`、`-f`、`--no-transfer-progress`**
- 多模块时每个模块单独 `cd` 执行，可并行：

```bash
(cd {project_root}/module1 && {mvn_path} org.jacoco:jacoco-maven-plugin:0.8.12:report -q) &
(cd {project_root}/module2 && {mvn_path} org.jacoco:jacoco-maven-plugin:0.8.12:report -q) &
wait
```

**命令失败时的唯一兜底**（执行一次，不再尝试其他变体）：

```bash
cd {project_root}/{module_path} && {mvn_path} jacoco:report 2>&1 | tail -20
```

> ❌ **禁止探索以下变体**：`mvn jacoco:report -pl ...`、`mvn jacoco:report -f ...`、`mvn jacoco:report --no-transfer-progress`、`mvn org.jacoco:... -pl ...`。变体探索 = 执行错误，直接归类 `runner_asset_failure`。

**步骤 4：合并覆盖率**
- `jacoco_incremental_coverage.sh` 指定多个 `--exec-file` 参数
- 最终报告中分模块记录各自覆盖率及总覆盖率

**约束**：
- 并行模块数上限：`min(CPU 核心数 - 1, 模块总数)`，默认最多并行 2 个模块
- 若只有单个模块有测试类，退化为串行执行
- 各模块完成后等 `wait` 全部完成，再进入增量覆盖率阶段
- 某模块失败仍需等待其余模块完成后统一汇总

## 2.0.5 多模块依赖编译兜底

若出现 `找不到符号` / `cannot find symbol`，但符号在源文件中实际存在：

**处理步骤**：
1. 识别依赖模块（从错误信息中提取包名/类名，比对 `pom.xml` 中的 `<module>` 列表）
2. 先编译依赖模块主代码（**不带 `-am`**）：
   ```bash
   mvn compile -pl {dependency_module} -q
   ```
3. 再用 `-Dmaven.compiler.includes` 精确编译目标模块的本轮测试类（**不带 `-am`**）：
   ```bash
   mvn test-compile -pl {target_module} \
     -Dmaven.compiler.includes="**/{本轮测试类}.java" -q
   ```
4. 仍失败 → **归类为 `compile_failure`，立即停止**；禁止升级为全量重编译

> ❌ **严禁**：
> - `mvn -am`（带 `-am` 会编译所有上游模块及其全量测试类）
> - `mvn clean install -DskipTests`（全量重编译，耗时且触发历史遗留错误）

**禁止**因"找不到符号"立即假设符号不存在并修改源码。

## 2.1 Surefire / JUnit 4 兼容兜底

若首轮 `mvn test` 命中：`maven-surefire-plugin:2.20` + JUnit 4 + `Tests run: 0`：
- 优先判定为 Runner 工具链兼容问题
- 必须按**原清单、原测试范围**重跑，仅覆盖 Surefire 版本：`-Dmaven-surefire-plugin.version=3.2.5`
- **禁止**修改 pom.xml、父 POM 或任何业务/测试源码
- 仍无法进入有效执行 → 归类为 `runner_asset_failure`，立即停止

## 2.1.5 沙箱 / 本地 Maven 仓库兜底

若首轮 `mvn test` 因沙箱限制无法写入 `~/.m2/repository` 失败：
- 优先判定为执行环境权限问题
- 以**完整权限**重跑一次，保持原清单、原测试范围、原 Maven 参数不变
- **禁止**缩小测试范围、修改 pom.xml、修改源码
- 仍失败 → 归类为 `runner_asset_failure`

## 2.2 `testFailureIgnore` 归类口径

- `mvn test` 退出码**不是**成败唯一依据
- 必须同时检查：`mvn test` 控制台摘要 + `target/surefire-reports` + 是否存在 FAIL / ERROR
- 只要测试已进入有效执行且存在 FAIL / ERROR，最终必须归类为 `test_failure`（即使 `mvn` 返回 `exit 0`）
- 禁止把 `testFailureIgnore=true` 造成的 `exit 0` 误判成 `success`

## 增量覆盖率脚本执行顺序

1. 先按默认缓存模式执行
2. 若出现 `NoClassDefFoundError`、参数契约不匹配、缓存 classpath 失效等工具链故障：
   - 清理脚本缓存目录
   - 用 `--no-cache --exec-file ...` **仅重试一次**
3. 仍失败 → 立即归类为 `runner_asset_failure`，停止探索式试错

## 2.5 运行约束

- 只执行普通单测 / slice tests
- 不得因为未启动本地服务、容器、真实数据库而返回 `environment_blocked`（mock-first 不依赖真实环境，此状态不存在）
- 若出现 `Failed to load ApplicationContext`（根因为 Nacos 连接失败），**按 `test_failure` 处理**（说明测试代码写错了，应修代码而非等环境）

## 覆盖率产物落盘约束

- 持久化到需求目录的正式产物只有 `{feature_dir}/unit_test_report.md`
- Maven/JaCoCo 构建产物可保留在 `target/` 下
- 若需诊断补充 XML/HTML，必须写入 `/tmp` 或 Runner 缓存目录
- **禁止**把补充产物写入 `req/.../test/_jacoco_feature/` 等需求目录
