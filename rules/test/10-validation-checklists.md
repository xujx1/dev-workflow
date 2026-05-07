# AI 测试生成检查清单

> 仓库级测试规约分片。用于生成测试代码前后自检，以及 Mock 边界审查。

---

## AI 生成测试前检查

```markdown
# AI 测试生成前置检查

## 必须明确的输入
- [ ] 被测方法签名已确认
- [ ] 业务需求 Spec 已定义
- [ ] 边界条件已列出
- [ ] 异常场景已识别

## 必须检查的约束
- [ ] 已明确 `basePackage`
- [ ] 已明确每个生成文件的目标目录与 `package` 映射

## mock-first 模式检查
- [ ] 测试类将放在**被测类所在模块**（如 `domain/src/test/java/`）
- [ ] **不**要求 Spring 容器 / 真实 DB / 真实 Redis
- [ ] **不**生成 `DataFactory` 数据工厂类
```

---

## AI 生成测试后检查

```markdown
# mock-first 后置验证

## 代码规范检查
- [ ] 测试类使用 `@RunWith(MockitoJUnitRunner.class)`
- [ ] 测试类**不**使用 `@SpringBootTest` / `@Transactional` / `@Rollback`
- [ ] 测试类**不**继承任何 Spring 测试基类
- [ ] 测试类**不**使用 `@Autowired`
- [ ] 每个新增 `.java` 文件都声明了正确 `package`
- [ ] `package` 声明与实际目录完全一致
- [ ] 测试方法为 `public` 修饰符且加了 `@Test` 注解
- [ ] 测试方法命名符合 `{scenarioId}_{brief_description}` 格式
- [ ] 使用 Given-When-Then 结构
- [ ] 断言有清晰的描述信息

## 测试类位置检查
- [ ] 测试类位于被测类所在模块（如被测类在 `domain`，测试类在 `domain/src/test/java/`）
- [ ] 测试类 `package` 与被测类 `package` 一致或在其子包下

## Mock 检查
- [ ] 所有依赖使用 `@Mock` / `@InjectMocks` 注入
- [ ] 数据库 Mapper/Repository 已 Mock
- [ ] Redis/缓存已 Mock
- [ ] RPC/HTTP 客户端已 Mock
- [ ] 无真实 DB/Redis/外部服务调用

## 数据检查
- [ ] **无**数据清理代码（`@Transactional` / `@Rollback` / `@AfterEach delete`）
- [ ] **无** `DataFactory` 类
- [ ] 测试数据通过 Mockito `when().thenReturn()` 构造

## 覆盖率检查
- [ ] 正常场景已覆盖
- [ ] 异常场景已覆盖
- [ ] 边界条件已覆盖
- [ ] 分支逻辑已覆盖

## 编译验证
- [ ] 模块级 `test-compile` 通过
- [ ] 无 Spring 容器相关编译错误
```

---

## Mock 边界检查

```markdown
# mock-first Mock 边界自查清单

## 允许 Mock 的对象（全部允许）
- [ ] 数据库 Mapper / Repository → 使用 `@Mock`
- [ ] Redis / 缓存 → 使用 `@Mock`
- [ ] RPC 客户端（Dubbo / Feign）→ 使用 `@Mock`
- [ ] HTTP 客户端 → 使用 `@Mock`
- [ ] MQ Producer → 使用 `@Mock`
- [ ] 内部 Service → 使用 `@Mock`
- [ ] 外部系统客户端 → 使用 `@Mock`

## 禁止项
- [ ] 无 `@MockBean` / `@SpyBean`（这些是 Spring 注解）
- [ ] 无 `@Autowired` 注入
- [ ] 无真实 DB/Redis 连接

## 示例
```java
@RunWith(MockitoJUnitRunner.class)
public class OrderServiceTest {

    @Mock
    private OrderMapper orderMapper;        // ✅ 数据库 Mock

    @Mock
    private RedisTemplate<String, Object> redisTemplate;  // ✅ Redis Mock

    @Mock
    private PaymentClient paymentClient;    // ✅ 外部系统 Mock

    @InjectMocks
    private OrderServiceImpl orderService;  // 被测类

    @Test
    public void tc001_should_create_order_when_stock_available() {
        // Given - Mockito 构造测试数据
        when(orderMapper.selectById(1L)).thenReturn(mockOrder);

        // When
        Result result = orderService.createOrder(1L);

        // Then
        assertNotNull(result);
        verify(orderMapper).selectById(1L);
    }
}
```
```
