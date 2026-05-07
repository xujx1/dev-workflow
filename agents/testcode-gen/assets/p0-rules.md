# testcode-gen P0 规则详情

> 本文件由 `testcode-gen-agent.md` 骨架按需 Read，不在骨架中内嵌。

## Step 0：API 契约扫描

- 读取 `agents/testcode-gen/assets/step0-contract-scan.md`（相对 `$HOME/.claude/plugins/dev-workflow`）
- 按该文件定义的步骤扫描被测类，生成「API 契约摘要」：
  - 被测方法签名（返回类型、参数列表、是否 void）
  - 异常类型溯源（BizAssert / Preconditions / throw 语句的实际异常类型）
  - Mockito stub 策略推导（void → doNothing，非 void → when().thenReturn()）
  - Mock 依赖识别
- 此步骤是**唯一允许**读取 `src/main/java/**` 的步骤
- 仅扫描 Phase 2 变更清单中涉及的被测类
- 此步骤必须在 Step 1（precheck）之前执行

### 0.1 依赖类包路径与 API 解析（查询优先策略）

**⚠️ getter/setter 豁免规则（必须优先判断）**

若所需方法是标准 getter/setter，**直接由字段名推导，跳过所有查找步骤**：
- `private T fieldName` → `getFieldName()` / `setFieldName(T value)`
- `private boolean flag` → `isFlag()` / `setFlag(boolean value)`

**⚠️ JAR 包方法签名强制验签规则（硬约束）**

凡是来自 JAR 包的类（即不存在于 `src/main/java` 下），调用以下任意一种时，**必须**通过 sources.jar 或 javap 获取实际签名后才能生成代码，**禁止猜测**：
- 构造器（参数个数、参数类型）
- 枚举值（常量名称）
- 非 getter/setter 的普通方法（方法名、参数类型、返回类型）

**步骤 1：优先从现有 import 语句查找**
```bash
grep -r "import.*ClassName" src/ --include="*.java" | head -1
```

**步骤 2：查询索引文件**
```bash
grep "	ClassName$" {project_root}/.claude/cache/dep-class-index.txt
```
- 命中 → 获得 `{jar路径}\t{FQCN}`，进入步骤 4
- 未命中 → 进入步骤 3（增量更新）

**步骤 3：增量更新索引（仅在未命中时执行）**
```bash
mvn dependency:resolve -DincludeScope=test -pl <module> -q
mvn dependency:sources -pl <module> -q
mvn dependency:build-classpath -DincludeScope=test \
  -Dmdep.outputFile=.claude/cache/deps-cp.txt -pl <module> -q
cat .claude/cache/deps-cp.txt | tr ':' '\n' | while read jar; do
  jar tf "$jar" 2>/dev/null | grep '\.class$' | grep -v '\$' \
    | sed "s|/|.|g; s|\.class$||" | while read cls; do
      printf '%s\t%s\n' "$jar" "$cls"
    done
done >> .claude/cache/dep-class-index.txt
```
更新后重新执行步骤 2。

**步骤 4：获取类的完整 API**
```bash
sources_jar="${jar%.jar}-sources.jar"
if [ -f "$sources_jar" ]; then
  unzip -p "$sources_jar" "$(echo $fqcn | tr '.' '/').java"
else
  javap -p -classpath "$jar" "$fqcn"
fi
```

所有类的解析结果写入内存「Mock API 摘要」，Step 3 生成代码时直接引用，**生成阶段禁止再执行任何 find / javap / grep 查找**。

---

## Step 2：真实入口定位

必须从 `test_spec` 中的被测入口或被测类向上找到真实入口：
- HTTP Controller
- Dubbo Facade
- MQ Listener / Consumer

禁止：
- 直接以 Service / 内部方法为入口
- 停留在 Handler / Adapter / Flow 中间层
- 找不到入口还继续生成

若因框架限制只能先生成局部方法级验证，必须在 `test_file_list` 中**如实标注**为`方法级/构造级验证`。

### 2.1 测试入口选择策略（必须执行）

**优先级 1：公共入口方法测试（JaCoCo 完整路径覆盖）**
```
若变更方法 A 被公共方法 B 调用：
  - 优先生成测试调用 B 方法
  - 覆盖率优势：JaCoCo 记录 B → A 完整执行路径
```

**优先级 2：反射调用私有方法（仅在无法通过公共入口触发时使用）**
```
仅当满足以下条件时使用反射：
  - 私有方法无公共入口调用
  - 或公共入口方法过于复杂（依赖过多外部服务）
  - 必须在测试类注释中标注原因
```

反射调用比例 < 30%，超过此比例应重新评估是否遗漏了公共入口方法。

---

## Step 3：真实类型与边界 Mock

- 只允许引用仓库中已存在的类型
- `basePackage` 必须在生成前确认
- 生成任何 `.java` 文件前，必须先确认精确 `package` 声明
- `test_runtime_mode` 固定为 `mock-first`，不读取外部配置
- **Mockito stub 策略必须引用 Step 0 的「API 契约摘要」**，禁止猜测
- **异常断言必须引用 Step 0 的「异常映射」**，禁止猜测异常类型

### mock-first 模式约束
- **禁止**参考工程里已有的单测代码
- 直接使用 `JUnit4 + Mockito`，不依赖 Spring 容器
- **必须**在被测类所在模块创建测试类
- **禁止**继承任何需要 Spring 容器的测试基类
- **禁止**数据工厂通过 Mapper 真实写库
- **禁止**使用 `@Transactional` / `@Rollback`
- **禁止**生成 `DataFactory` 数据工厂类
- HTTP Controller：优先生成 standalone `MockMvc`（`MockMvcBuilders.standaloneSetup(...)`）
- 仅当仓库已存在 `mockito-core` / `org.mockito.junit.MockitoJUnitRunner` 时才生成 `@RunWith(MockitoJUnitRunner.class)`

---

## Step 4：产物范围

只允许生成：
- `src/test/java/{basePackage}/tdd/component/*.java`
- `src/test/java/{basePackage}/tdd/data/*DataFactory.java`
- 必要的测试支撑类
- `{feature_dir}/test_file_list.md`

所有 `.java` 文件落盘路径与 `package` 声明一一对应。

每个测试方法上方必须添加 `//` 行注释：
```java
// 用例名称: CASE-001-主流程正常下单
// 预期结果: EX1-订单状态为已确认; EX2-生成运单号
@Test
public void testNormalOrder() { ... }
```

**批量生成原则**：若本轮需要生成多个测试类，必须先**批量完成全部落盘**，再统一进入编译 gate。禁止"生成 1 个 → 立即 test-compile → 再生成下一个"的串行慢路径。

---

## Step 5：编译 gate

- 使用 `-Dmaven.compiler.includes` 将编译范围**精确限定**到本轮新增/修改的测试类，一次性汇总后传入
- 编译失败时，首先判断失败文件是否属于本轮生成列表：
  - **不属于**（历史遗留文件）→ 视为噪音，跳过，本次任务继续
  - **属于**本轮 → 执行修复，最多 3 轮
- 连续 2 轮无进展立即停止
- ❌ **禁止使用 `-am` 标志**（会触发上游模块全量测试类编译）
- ❌ **禁止使用 `mvn clean install -DskipTests`**（全量重编译）
- 遇环境类问题立即中断，不得冒充代码问题

**示例命令**：
```bash
mvn -pl {被测模块} test-compile \
  -Dmaven.compiler.includes="**/{TestClass1}.java,**/{TestClass2}.java"
```

---

## Step 6：JaCoCo 职责

本 Agent 只负责确保后续 Runner 可运行：
- 检查 JaCoCo 插件声明是否存在
- 必要时补全最小配置
- 只通过 `test-compile` 验证配置不破坏构建

禁止在本阶段执行 `mvn test`、`jacoco:report`、覆盖率判断。

---

## Step 7：test_file_list 禁止规则

`test_file_list.md` 是纯文本清单文件，不是 Java 源码。S5 只允许写入文件，**禁止**执行任何 `mvn`/`javac` 命令。
