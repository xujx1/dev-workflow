# Step 3 边界 Mock 与代码生成（P0）

## 目标

基于 `test_spec` 和真实入口，生成最小可编译测试产物。

## 注入方式检测（22a — 混合注入必读）

生成 `@InjectMocks` 前，必须先检测被测类注入方式：

```bash
# 检测被测类是否同时存在构造函数注入 + 字段注入（@Resource/@Autowired）
grep -n "@Resource\|@Autowired" {被测类路径} | head -20
grep -n "public {ClassName}(" {被测类路径}  # 检查是否有带参构造函数
```

**决策规则**：

| 检测结果 | 生成策略 |
|---------|---------|
| 纯字段注入（只有 @Resource/@Autowired，无带参构造） | 使用 `@InjectMocks` |
| 纯构造函数注入（只有带参构造，无 @Resource/@Autowired） | 使用 `@InjectMocks` |
| **混合注入**（带参构造 + @Resource/@Autowired 字段并存） | **禁止 `@InjectMocks`**，改用手动构造 + `ReflectionTestUtils.setField` |

**混合注入时的标准写法**（硬约束）：

```java
// ❌ 禁止：混合注入下 @InjectMocks 只初始化构造参数，字段依赖为 null
@InjectMocks
private FooService fooService;

// ✅ 正确：手动构造注入构造参数，字段依赖用 ReflectionTestUtils
private FooService fooService;

@Before
public void setUp() {
    // 1. 手动构造（注入构造函数参数）
    fooService = new FooService(constructorDep1, constructorDep2);
    // 2. 字段注入依赖用 ReflectionTestUtils
    ReflectionTestUtils.setField(fooService, "fieldDep1", fieldDep1Mock);
    ReflectionTestUtils.setField(fooService, "fieldDep2", fieldDep2Mock);
}
```

> **注**：`ReflectionTestUtils` 来自 `org.springframework.test.util.ReflectionTestUtils`，已包含在 `spring-test` 依赖中。

---

## Mock 决策

测试模式固定为 `mock-first`：

- HTTP 场景：standalone `MockMvc`（`MockMvcBuilders.standaloneSetup(controller)`），禁止 `@WebMvcTest`
- 非 HTTP 场景：纯 Mockito（`MockitoAnnotations.initMocks(this)` 或 `@RunWith(MockitoJUnitRunner.class)`，仅仓库已存在 mockito-core 时）
- 所有外部依赖（DB / Redis / RPC / MQ / HTTP）一律 `Mockito.mock()` 或 `@Mock`
- 不要求本地服务、容器、真实 DB/Redis

## 生成产物

- `JUnit4 + Mockito` / standalone `MockMvc` / `MockitoExtension(only-if-available)`
- 必要支撑类
- `test_file_list.md`

## 生成约束

- 只允许写入 `src/test/java/.../tdd/`
- 只允许 `.java`
- 每个新文件都必须先确定目标目录，再写对应的首行 `package`
- `package` 声明必须与真实落盘路径严格一致；例如：
  - `src/test/java/{basePackage}/tdd/component/FooTest.java` → `package {basePackage}.tdd.component;`
- 禁止复用其他测试类的 `package` 后忘记按新目录修正
- HTTP 测试默认不得依赖 `@WebMvcTest` 启动 Spring MVC 上下文；应优先手工 new Controller + standalone `MockMvc`
- 若仓库不存在 `org.mockito.junit.MockitoJUnitRunner`，**不得**生成 `import org.mockito.junit.MockitoJUnitRunner;` 或 `@ExtendWith(MockitoExtension.class)`；应改用 `MockitoAnnotations.initMocks(this)`
- Then 块必须至少覆盖关键状态断言
- `M{N}` / `EX{N}` 注释与断言要与 `test_spec` 对齐

## 最小核对

- 每条测试都能映射回 `test_spec`
- 每个外部依赖都有明确 Mock / Spy 策略
- `test_file_list` 与生成测试类一致
- 每个 `.java` 文件的 `package` 声明与其在 `src/test/java` 下的真实目录完全一致

## Mockito Stub 策略引用

- 使用 Step 0 生成的「API 契约摘要」中的 Mockito stub 策略
- void 方法使用 `doNothing().when(mock).method()`
- 非 void 方法使用 `when(mock.method()).thenReturn(value)`
- 禁止猜测方法返回类型，必须以契约摘要为准

### setupCommonMocks 冗余 Stub 红线（硬约束）

`@Before` / `setupCommonMocks` 公共方法中的 stub 会对**所有**测试用例生效。若某个 stub 对应的代码路径在部分/全部用例中不可达，`MockitoJUnitRunner`（Strict Stubs 模式）将在测试类收尾阶段抛出 `UnnecessaryStubbingException`，导致整个测试类失败。

**典型根因（必须识别）**：
```
setupCommonMocks 中:  when(mapperA.selectByX(any())).thenReturn(null)   // 返回 null
实现代码中:           if (Objects.nonNull(resultA)) {
                        serviceB.doSomething(...);  // 永不进入
                      }
setupCommonMocks 中:  when(serviceB.doSomething(...)).thenReturn("x")  // ← 冗余 Stub！
```

**生成规则（三步检查，违反任一条视为生成失败）**：

1. **可达性前置扫描**：在将任何 stub 放入公共 `@Before` 方法前，必须先读取被测类对应的条件分支，确认该 stub 在至少一个用例中可被执行到。
2. **条件 stub 下沉原则**：若 stub B 的调用依赖 stub A 的返回值（如 `A != null` 才会调用 B），则 stub B **必须**放入使用该路径的具体测试方法内，不得放入公共 `@Before`。
3. **生成完成后自检**：生成全部测试方法后，逐条检查 `@Before` 中每个 stub，确认至少一个具体测试方法会调用该 stub；若无，将该 stub 移至对应测试方法内或直接删除。

**禁止模式**（出现即为冗余 Stub 风险）：
```java
// ❌ setupCommonMocks 中：stub B 依赖 A 的非 null 返回，但 A 返回 null
when(mapperA.selectByX(anyString())).thenReturn(null);           // A 返回 null
when(serviceB.getPrintName(any(), anyString(), any(), any()))    // B 永不被调用
    .thenReturn("运动鞋");
```

**正确模式**：
```java
// ✅ setupCommonMocks 只保留全量可达的公共 stub
when(mapperA.selectByX(anyString())).thenReturn(null);

// ✅ 依赖 A 非 null 的 stub 下沉到具体用例
@Test
public void testWhenWaybillExtExists() {
    WaybillExt ext = new WaybillExt(); // 覆盖公共 stub
    when(mapperA.selectByX(anyString())).thenReturn(ext);
    when(serviceB.getPrintName(any(), anyString(), any(), any())).thenReturn("运动鞋");
    // ...
}
```

---

### doNothing() 使用红线（硬约束）

`doNothing()` **只能**用于返回 `void` 的方法。对非 void 方法使用 `doNothing()` 会直接导致 Mockito 运行时 ERROR。

**禁止模式**（出现即视为生成失败）：
```java
// ❌ LogInfoService.addLogInfo 返回 int，非 void
doNothing().when(logInfoService).addLogInfo(anyInt(), any(), anyInt(), any());
```

**正确模式**：
```java
// ✅ 非 void → when().thenReturn()
when(logInfoService.addLogInfo(anyInt(), any(), anyInt(), any())).thenReturn(1);
```

**强制校验规则**（生成任何 stub 代码前必须先确认返回类型）：
1. 先查 Step 0 的「Mock 依赖方法返回类型映射」
2. 若返回类型标注为 `void`（或 `void: true`），使用 `doNothing().when(mock).method()`
3. 若返回类型**不是** `void`（如 `int`、`Boolean`、`Result<T>` 等），**必须**使用 `when(mock.method()).thenReturn(value)`
4. **禁止**对任何非 void 方法使用 `doNothing()`，即使 Mockito 默认对未 stub 方法返回 null/默认值，也不得用 `doNothing()`
5. 若 Step 0 的契约摘要中缺少某方法的返回类型信息，**必须**读取该依赖的接口文件确认，禁止猜测

## 异常断言引用

- 使用 Step 0 生成的「异常映射」中的异常类型
- 测试用例中的 `expected` 异常必须与溯源结果一致
- 禁止使用泛型异常类型（如 `Exception`、`RuntimeException`）作为猜测

## 生成后校验（Step 3.5，必须执行）

- 所有测试类生成完成后，必须执行 `step3.5-mode-validator.md`（模式契约校验器）
- 禁止 Spring 注解（`@SpringBootTest`、`@WebMvcTest`、`@MockBean` 等），强制 standalone MockMvc + 纯 Mockito
- 发现违反时优先自动修正，无法修正时中断并报告
- 此步骤必须在 Step 4（编译 gate）之前执行
