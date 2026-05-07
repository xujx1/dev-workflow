# 测试数据模型

> 仓库级测试规约分片。mock-first 模式下，测试数据通过 Mockito `when().thenReturn()` 构造，无需 DataFactory。

---

## mock-first 测试数据构造规范

```java
// ✅ 通过 Mockito 构造测试数据
@Mock
private OrderMapper orderMapper;

@Test
public void tc001_should_return_order_when_order_exists() {
    // Given - 使用 Mockito 构造
    OrderDO order = new OrderDO();
    order.setId(1L);
    order.setStatus(OrderStatus.PENDING.getCode());
    when(orderMapper.selectById(1L)).thenReturn(order);

    // When / Then ...
}
```

## 禁止项

- 禁止在测试中真实写入数据库（无需 DataFactory、无需 `@Transactional @Rollback`）
- 禁止在测试用例中直接写 INSERT SQL
- 禁止使用 H2 内存数据库模拟真实 DB 行为
