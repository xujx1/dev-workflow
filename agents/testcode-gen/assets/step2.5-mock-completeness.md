# Step 2.5 Mock 完整性检查（P0）

> 本步骤在 Step 2（真实入口定位）完成后、Step 3（代码生成）开始前执行。
> 目标：确保所有依赖都有对应的 @Mock 声明，防止部分依赖为 null 导致 NPE。

## 执行步骤

### 2.5.1 扫描被测类全部依赖

```bash
# 扫描构造函数参数（注入依赖）
grep -n "public {ClassName}(" {被测类路径} -A 10 | grep -E "^\s+\w+\s+\w+"

# 扫描字段注入（@Resource / @Autowired / @Value）
grep -n "@Resource\|@Autowired\|@Value" {被测类路径} -A 1
```

输出格式（构建「依赖清单」，内存中维护）：

```
依赖清单:
  - constructorParam: OrderService orderService  [构造注入]
  - constructorParam: RpcClient rpcClient        [构造注入]
  - field: @Resource LogInfoService logInfoService [字段注入]
  - field: @Autowired RedisTemplate redisTemplate  [字段注入]
```

### 2.5.2 对比 test_spec 中的 @Mock 声明

读取 `test_spec -> ## 5. Mock 桩` 中已声明的 Mock 列表，与「依赖清单」逐项对比：

```
已声明 Mock:
  - OrderService ✅
  - RpcClient ✅
  - LogInfoService ❌ 缺失
  - RedisTemplate ❌ 缺失
```

### 2.5.3 自动补充缺失 Mock

对于每个缺失项，输出缺失警告并在生成的测试类中自动补充：

```java
// [Step 2.5 自动补充] test_spec 未声明，从被测类依赖扫描中发现
@Mock
private LogInfoService logInfoService;

@Mock
private RedisTemplate<String, Object> redisTemplate;
```

**补充规则**：
- `@Value` 字段注入：改用 `ReflectionTestUtils.setField` 注入字面量，**不生成** `@Mock`
- 外部系统（RPC/HTTP/DB/Redis/MQ）：必须生成 `@Mock`
- 内部 Spring Bean：生成 `@Mock`

### 2.5.4 输出 Mock 完整性报告

在执行日志中输出（不写入文件）：

```
[Step 2.5] Mock 完整性检查结果：
  被测类：{ClassName}
  依赖总数：N
  test_spec 已声明：M
  自动补充：K（{字段名列表}）
  ⚠️ 手动确认项：P（如泛型类型需人工核对）
```

### 2.5.5 反射调用入口方法体依赖扫描（P0）

**触发条件**：Step 2 识别到测试入口为 `ReflectionTestUtils.invokeMethod(obj, "X", ...)` 且 X **不等于** test_spec 中声明的新功能方法名（即 X 是调用新功能的外层包装/总调度方法）。

**问题根因**：外层方法 X 除了调用新功能外，还会继续执行其他字段方法调用（如旧逻辑分支）。这些字段在 test_spec 的 Mock 桩章节中未声明，2.5.1 的类级注解扫描虽然能找到它们，但在 2.5.2 与 test_spec 对比时可能因为"test_spec 聚焦新功能"而被误判为"不需要 mock"，从而漏补。

**扫描动作**：

```bash
# 1. 定位外层入口方法 X 的行号范围
grep -n "public\|private\|protected" {被测类路径} | grep " X("

# 2. 提取方法体内所有字段引用（形如 this.fieldName. 或 fieldName.）
# 在确认的行号范围内扫描
sed -n '{start},{end}p' {被测类路径} | grep -oE "(this\.)?[a-z][a-zA-Z0-9]+\." | sort -u
```

**比对规则**：

1. 将方法体内出现的字段名与「依赖清单」（2.5.1 输出）逐一核对
2. 凡是方法体内出现的字段引用 **且** 在「依赖清单」中存在 **且** 未在 `@Mock` 声明列表中 → **强制加入补充 Mock 清单**，不允许因"test_spec 未提及"而跳过
3. 在报告中单独列出此类补充项，标注来源：`[Step 2.5.5 入口方法体扫描补充]`

**典型错误场景**（必须识别）：

```
test_spec 关注点：subscribeSignImg（新功能）
实际测试入口：sfSubscribePicture（外层方法，invokeMethod 调用）

sfSubscribePicture 方法体：
  → subscribeSignImg(...)          ← test_spec 关注，Mock 已声明
  → packageMaterialPhotoMapper     ← 旧逻辑字段，test_spec 未提及
    .queryByLogisticsAndWaybillNo(...) ← 若未 Mock → NPE
```

**结论**：入口方法体内所有字段引用必须全部 mock，无论是否在 test_spec 的关注范围内。

---

## 执行前提

- 已完成 Step 2（真实入口已确认）
- 已完成 Step 0 API 契约扫描（「Mock API 摘要」已在内存中）
- 被测类路径已知（从 test_spec 或 Step 2 结果中获取）

## 跳过条件

以下情况可跳过本步骤（需在日志中标注跳过原因）：
- 被测类字段数 ≤ 2 且无构造注入（依赖极少，风险低）
- test_spec 中已标注 `mock_completeness_checked: true`

## 与 Step 3 的衔接

本步骤输出的「补充 Mock 清单」直接传递给 Step 3：
- Step 3 生成测试类时，必须将补充 Mock 并入 `@Mock` 声明区
- 注入方式检测（22a）基于完整的依赖清单执行，不得遗漏补充项
