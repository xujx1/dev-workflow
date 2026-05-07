# Step 0 API 契约扫描（P0）

## 目标

在生成测试代码前，通过静态分析被测代码的公共方法签名、返回类型、异常类型和内部依赖调用，生成「API 契约摘要」，供后续生成步骤引用，消除"猜测"导致的测试代码错误。

## 适用范围

本步骤是 `testcode-gen-agent` 中**唯一允许读取 `src/main/java/**` 的步骤**。
仅允许读取：
- Phase 2 变更清单（`change-manifest-phase2.md` 或技术方案 §5 改动文件清单）中涉及的被测类
- 被测类中直接引用的校验器、断言工具类（如 `BizAssert`、`Preconditions`）

禁止：
- 读取无关的 `src/main/java` 文件
- 读取外部依赖实现代码
- 读取历史测试代码作为参考

## 扫描步骤

### 1. 识别被测类

从 `test_spec` 的 `## 2. 需求实现分析` 和 `### 2.3 被测入口` 中提取：
- 被测 Controller / Facade / Listener 类的全限定名
- 被测 Executor / Handler / Service 类的全限定名

### 2. 方法签名扫描

对每个被测类，读取其源文件，提取所有 **public 方法**的签名信息：

```
方法签名记录：
{类名}.{方法名}({参数类型列表}) → {返回类型}
```

关键字段：
- `returnType`：void / 具体类型
- `isVoid`：true/false（决定 Mockito stub 策略）

### 3. 异常类型溯源

对测试中需要断言异常的场景，溯源实际使用的异常类型：

- 读取被测类中所有 `throw` 语句中的异常类型
- 读取被测类中 `BizAssert` / `Preconditions` / `Validate` 等校验工具的使用方式
- 如需溯源校验工具类，可读取其源文件确定其实际抛出的异常类型

输出：
```
异常映射：
- BizAssert.hasText → MasterDataBizException
- Preconditions.checkArgument → IllegalArgumentException
- 直接 throw → [具体异常类型列表]
```

### 4. Mockito stub 策略推导

根据方法签名中的返回类型，推导正确的 stub 策略：

| 方法返回类型 | stub 策略 |
|------------|-----------|
| void | `doNothing().when(mock).method()` 或 `doThrow().when(mock).method()` |
| 非 void | `when(mock.method()).thenReturn(value)` |

### 5. Mock 依赖识别（含方法返回类型扫描）

读取被测类的 `@Autowired` / `@Inject` / 构造函数注入字段，识别所有需要 Mock 的依赖：

- Mapper / DAO / Repository → 需要 Mock
- 外部 Dubbo API → 需要 Mock
- MQ Producer / Consumer → 需要 Mock
- HTTP Client → 需要 Mock
- 内部 Service / Executor → 根据测试模式决定是否 Mock

**Mock 依赖方法返回类型扫描（硬约束，必须执行）**：

对每个需要 Mock 的依赖类型，读取其接口/类定义文件，**扫描测试代码中会 stub 到的方法**，记录其返回类型。

示例输出：
```
Mock 依赖方法返回类型映射：
- LogInfoService.addLogInfo(Integer, String, Integer, String) → int  (非 void，使用 when().thenReturn())
- LogInfoService.addLogInfo(Integer, String, Integer, String, String) → int  (非 void，使用 when().thenReturn())
- PinkLogMessageProducer.send(Message) → void  (使用 doNothing())
- ExtendScpSizeMeasurementRuleMapper.selectById(Long) → ScpSizeMeasurementDo  (非 void)
- ExtendScpSizeMeasurementRuleMapper.updateCloseInfo(Long, Integer) → int  (非 void)
- SizeMeasureInfoApi.cancelManualMeasureInfo(CancelSizeMeasureRequest) → Result<Boolean>  (非 void)
```

**扫描规则**：
1. 优先读取被测类（Executor / Service）中调用这些依赖方法的代码行，确认实际调用的方法签名
2. 读取被调用方法所在的接口/类文件，确定其返回类型
3. 根据返回类型标记 stub 策略：**void → `doNothing()` / `doThrow()`，非 void → `when().thenReturn()`**
4. **禁止猜测返回类型**，必须以实际读取的接口定义为准

## 输出

在内存中生成以下结构的「API 契约摘要」，供 Step 2 / Step 3 引用：

```
## API 契约摘要

### 被测方法
- {类名}.{方法名}({参数列表}) → {返回类型}

### Mock 依赖
- {字段名}: {类型} → 需要 Mock

### Mock 依赖方法返回类型映射（硬约束）
- {依赖类}.{方法名}({参数列表}) → {返回类型} | void: true/false
- 例：LogInfoService.addLogInfo(Integer, String, Integer, String) → int | void: false

### 异常映射
- BizAssert.hasText → MasterDataBizException
- ...

### Mockito Stub 策略（引用上述返回类型映射，禁止猜测）
- {依赖字段}.{方法名} → when().thenReturn() / doNothing().when()
  （依据：方法返回 int，非 void，必须用 when().thenReturn()，禁止用 doNothing()）
```

## 中断条件

- 被测类文件不存在或无法读取
- 无法识别 public 方法签名
- 无法确认 `basePackage`

## 常见框架类方法签名（硬编码规则）
在生成测试断言时，必须正确识别以下常见框架类的方法签名，避免调用错误：
### 1. `com.poizon.fusion.common.model.Result`（响应包装类）
**错误用法**（常见陷阱）：
```java
Result<List<Data>> result = controller.queryData();
assertTrue(result.isSuccess());  // ❌ 编译错误！isSuccess 是静态方法
```
**正确用法**：
```java
Result<List<Data>> result = controller.queryData();
assertTrue(Result.isSuccess(result));  // ✅ 静态方法，需要传入 Result 对象
```
**方法签名速查**：
| 方法 | 签名 | 说明 |
|------|------|------|
| `isSuccess` | `static boolean isSuccess(Result<?> result)` | **静态方法**，需传入 Result 对象 |
| `getCode` | `long getCode()` | 实例方法 |
| `getData` | `T getData()` | 实例方法 |
| `getMsg` | `String getMsg()` | 实例方法 |
| `ofSuccess` | `static <T> Result<T> ofSuccess(T data)` | 静态工厂方法 |
**硬约束**：生成测试代码时，如果涉及 `Result` 类的断言，**必须**使用 `Result.isSuccess(result)` 而非 `result.isSuccess()`。
### 2. 其他常见响应包装类
| 类名 | 成功判断方法 | 备注 |
|------|------------|------|
| `com.poizon.fusion.common.model.Result` | `Result.isSuccess(result)` | 静态方法 |
| `com.alibaba.cola.dto.Response` | `response.isSuccess()` | 实例方法 |
| `com.alibaba.cola.dto.Command` | 无 isSuccess | 检查其他字段 |
**扫描输出格式更新**：
在 API 契约摘要中，对于返回 `Result<T>` 的方法，必须额外标注：
```
### 被测方法
- Commodity3DPropertyController.queryCloseReason() → Result<List<CloseReasonDTO>>
  ⚠️ 断言时使用 Result.isSuccess(result)，非 result.isSuccess()
```