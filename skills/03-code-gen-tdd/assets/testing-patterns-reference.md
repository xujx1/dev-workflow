---

## name: testing-patterns
description: Java/Spring Boot 项目测试策略速查手册。涵盖单元测试、集成测试、测试分层和常见陷阱。当编写测试或 review 测试代码时使用。

# Java 测试策略（浓缩索引）

---

## 测试分层

```
单元测试    纯逻辑，Mock 所有外部依赖，执行快（< 100ms/用例）
集成测试    测 Mapper/Repository，使用 H2 或 TestContainer
接口测试    测 Controller/DubboService，Spring 容器启动
E2E 测试    完整链路，仅测核心 Happy Path
```

**80% 价值在单元测试**，优先覆盖业务逻辑层（Application / Domain）。

---

## 单元测试规范

```java
// ✅ 标准结构（JUnit 5 + Mockito）
@ExtendWith(MockitoExtension.class)
class MakeWaybillServiceTest {

    @InjectMocks
    private MakeWaybillService service;

    @Mock
    private WaybillRepository waybillRepository;

    @Test
    @DisplayName("正常下单：承运商返回运单号后存库成功")
    void makeWaybill_success() {
        // Arrange
        given(waybillRepository.save(any())).willReturn(mockDO());
        // Act
        Result<String> result = service.make(mockRequest());
        // Assert
        assertThat(result.isSuccess()).isTrue();
        verify(waybillRepository).save(any());
    }
}
```

---

## 必测场景清单

每个业务方法至少覆盖：

```
Happy Path   正常输入 → 正确输出
边界值        空值、零值、最大值
异常分支      外部服务抛异常 → 降级/返回错误
幂等性        重复调用 → 结果一致（MQ 消费者、写接口）
并发安全      高频场景是否有竞态条件
```

---

## 常见陷阱


| 陷阱           | 错误写法                      | 正确写法                                                 |
| ------------ | ------------------------- | ---------------------------------------------------- |
| 测试依赖执行顺序     | 用 `@TestMethodOrder` 控制顺序 | 每个测试独立，`@BeforeEach` 初始化                             |
| Mock 不完整     | 只 Mock Happy Path         | Mock 所有外部调用分支                                        |
| 断言太弱         | `assertNotNull(result)`   | 断言具体字段值                                              |
| 测 private 方法 | 用反射调 private              | 测 public 方法的行为，private 是实现细节                         |
| 共享 Mock 状态   | static mock 不 reset       | `MockitoAnnotations.openMocks(this)` 或 `@ExtendWith` |


---

## Mapper 集成测试

```java
@MybatisTest          // 只加载 MyBatis 层，不启动完整 Spring
@AutoConfigureTestDatabase(replace = NONE)  // 使用真实 DB（TestContainer）
class WaybillMapperTest {

    @Autowired
    private WaybillMapper mapper;

    @Test
    void selectByWaybillNo_found() {
        WaybillDO result = mapper.selectByWaybillNo("SF12345");
        assertThat(result).isNotNull();
        assertThat(result.getStatus()).isEqualTo(1);
    }
}
```

---

## 测试覆盖率目标

```
整体覆盖率       ≥ 80%
Domain 层       ≥ 90%（核心业务逻辑）
Application 层  ≥ 80%
Infrastructure  ≥ 60%（主要 Mapper 方法）
```

---
