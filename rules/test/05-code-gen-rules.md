# AI 生成测试代码规范

> 仓库级测试规约分片。用于约束测试代码生成、Mock 边界、断言方式与语言/目录硬约束。
>
> 测试模式固定为 **mock-first**：JUnit4 + Mockito，不依赖 Spring 容器与真实数据库。

---

## 生成输入要求

AI 生成测试代码前必须提供：

| 输入 | 来源 | 必需 |
|------|------|------|
| test_spec 文档 | `{feature_dir}/test_spec.md` | ✅ 必需 |
| 技术方案 | `{feature_dir}/tech-design.md` | ✅ 必需 |
| 应用知识库 | `app-knowledge-base/` | 推荐 |

---

## 生成规范

### 语言与目录硬约束

- 测试代码**只能**生成到 `src/test/java/`
- 测试文件**只能**是 `.java`
- 测试框架统一使用 JUnit4 + Mockito
- **禁止** Groovy
- **禁止** Spock
- **禁止** `src/test/groovy/`
- **禁止** 生成 `*Spec.groovy`

### 类结构

```java
@RunWith(MockitoJUnitRunner.class)
public class {Feature}Test {

    @Mock
    private OrderMapper orderMapper;       // 数据库 Mock

    @Mock
    private RedisTemplate<String, Object> redisTemplate;  // Redis Mock

    @InjectMocks
    private {Feature}Service featureService;  // 被测类

    @Test
    // 用例名称: TC-M-001 查询订单-订单存在-返回订单信息
    // 预期结果: EX1-返回订单信息
    public void tc001_should_return_order_when_order_exists() {
        // Given - 使用 Mockito 构建测试数据
        OrderDO order = new OrderDO();
        order.setId(1L);
        when(orderMapper.selectById(1L)).thenReturn(order);

        // When
        Result result = featureService.doSomething(1L);

        // Then
        assertNotNull(result);
        verify(orderMapper).selectById(1L);
    }
}
```

**禁止项**：
- ❌ `@SpringBootTest`
- ❌ `@AutoConfigureMockMvc`
- ❌ `@Transactional` / `@Rollback`
- ❌ 继承任何需要 Spring 容器的基类
- ❌ `@Autowired`
- ❌ `DataFactory` 数据工厂类

### 方法命名

```
方法命名格式：{scenarioId}_{brief_description}
示例：tc001_should_create_order_when_stock_available
      tc002_should_fail_when_stock_insufficient
```

每个测试方法上方必须添加 `//` 行注释，标注来自 `test_spec` 的用例名称和预期结果：

```java
// 用例名称: TC-M-001 结算重量触发-全部条件满足-返回SUCCESS
// 预期结果: EX1-返回SUCCESS
@Test
public void tc001_should_create_order_when_stock_available() {
    // ...
}
```

**行注释格式要求**：
- 用例名称来自 `test_spec` 中的用例编号和名称
- 预期结果取自对应用例的 `EX{N}` 断言点
- 示例：
  - `// 用例名称: TC-M-001 正常创建订单-单商品-返回成功`
  - `// 预期结果: EX1-返回订单ID`
  - `// 用例名称: TC-E-001 库存不足时创建订单-抛出异常`
  - `// 预期结果: EX1-抛出InsufficientInventoryException`

### 断言规范

```java
// ✅ 精确断言
.andExpect(status().isOk())
.andExpect(jsonPath("$.code").value(0))
.andExpect(jsonPath("$.data.orderNo").isNotEmpty())

// ❌ 禁止模糊断言
.andExpect(status().is2xxSuccessful())  // 范围太宽
assertNotNull(result);                   // 没有语义
```

---

## Mock 规范

```java
// ✅ 允许 Mock 所有依赖
@Mock
private OrderMapper orderMapper;        // ✅ 数据库可 Mock

@Mock
private OrderService orderService;      // ✅ 内部 Service 可 Mock

@Mock
private ThirdPartyPaymentClient paymentClient;  // ✅ 外部系统可 Mock

@Mock
private RedisTemplate<String, Object> redisTemplate;  // ✅ Redis 可 Mock
```

**Mock 边界原则**：所有数据库、Redis、RPC、MQ、HTTP 及直接协作者都可以 Mock，不要求真实执行。

---

## 数据清理

**不需要数据清理**。所有数据库交互都是 Mock，没有真实写库操作。

```java
// ✅ 不需要任何数据清理注解
@RunWith(MockitoJUnitRunner.class)
public class OrderTest {
    // 纯 Mock 测试，无需事务回滚
}
```

---

## 测试类位置

**必须**在被测类所在模块创建测试类，确保覆盖率数据准确。

```
被测类：domain/src/main/java/com/example/service/impl/OrderServiceImpl.java
测试类：domain/src/test/java/com/example/tdd/component/OrderServiceTest.java
```

---

## 覆盖率要求

- 每个 P0 场景必须有对应测试用例
- 行覆盖率 ≥ 80%（由 JaCoCo 报告验证）
- 核心业务路径（Controller → Service → Mapper）全链路覆盖
