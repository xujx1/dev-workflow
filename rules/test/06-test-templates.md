# 测试代码生成模板

> 仓库级测试规约分片。提供 mock-first 模式下的标准测试模板与 Prompt 模板。

---

## mock-first 测试模板

```java
/**
 * AI 生成测试的标准模板（mock-first）
 *
 * 遵循测试规约：
 * 1. JUnit4 + Mockito，不依赖 Spring 容器
 * 2. 使用 @Mock / @InjectMocks
 * 3. 遵循 Given-When-Then 结构
 * 4. 每个测试方法添加 // 用例名称 / // 预期结果 注释
 */
@RunWith(MockitoJUnitRunner.class)
public class OrderServiceTest {

    @Mock
    private OrderMapper orderMapper;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @InjectMocks
    private OrderServiceImpl orderService;

    // ==================== 正常场景 ====================

    // 用例名称: TC-M-001 正常创建订单-单商品-返回成功
    // 预期结果: EX1-返回订单ID
    @Test
    public void tc001_should_create_order_successfully_when_single_item() {
        // Given: 准备测试数据
        OrderDO order = new OrderDO();
        order.setId(1L);
        order.setStatus(OrderStatus.PENDING.getCode());
        when(orderMapper.selectById(1L)).thenReturn(order);

        // When: 执行被测方法
        Result result = orderService.getOrder(1L);

        // Then: 验证结果
        assertNotNull("结果不应为空", result);
        assertEquals(1L, result.getData().getId().longValue());
        verify(orderMapper).selectById(1L);
    }

    // ==================== 异常场景 ====================

    // 用例名称: TC-E-001 订单不存在-查询-抛出异常
    // 预期结果: EX1-抛出OrderNotFoundException
    @Test(expected = OrderNotFoundException.class)
    public void tc002_should_throw_exception_when_order_not_exists() {
        // Given
        when(orderMapper.selectById(999L)).thenReturn(null);

        // When & Then
        orderService.getOrder(999L);
    }
}
```

---

## AI 生成测试的 Prompt 模板

```markdown
# AI 生成测试用例的 Prompt 模板

## 输入
- 被测方法签名: `{method_signature}`
- 业务需求 Spec: `{spec_content}`
- 边界条件: `{boundary_conditions}`

## 输出要求

生成符合以下规范的测试代码:

1. **测试类结构**
   - 添加 `@RunWith(MockitoJUnitRunner.class)`
   - 使用 `@Mock` / `@InjectMocks` 注入依赖

2. **测试方法组织**
   - 按场景分组: 正常场景 / 异常场景 / 边界场景
   - 命名格式: `{scenarioId}_should_{预期行为}_when_{条件}`，方法修饰符用 `public`
   - 使用 Given-When-Then 结构

3. **行注释（必须）**
   - 每个测试方法上方添加：
     - `// 用例名称: {scenarioId} {场景名称}`
     - `// 预期结果: EX1-{主断言}`

4. **数据构造**
   - 使用 Mockito `when().thenReturn()` 构造测试数据
   - 禁止真实写库、禁止 DataFactory

5. **断言规范**
   - 使用 JUnit 4 断言（`org.junit.Assert.*`）
   - 异常断言使用 `@Test(expected = XxxException.class)`
   - 验证业务状态而非技术细节

## 示例输出

```java
// 用例名称: TC-M-001 正常创建订单-单商品-返回成功
// 预期结果: EX1-返回订单ID
@Test
public void tc001_should_{预期行为}_when_{条件}() {
    // Given
    {使用 Mockito 构造数据}

    // When
    {调用被测方法}

    // Then
    {验证业务结果}
}
```
```

