# 测试先行原则（Test-First Principle）

> 仓库级测试规约分片。用于定义任何测试相关任务都必须优先遵守的入口与 TDD 原则。

---

## 核心原则

**严禁直接写业务代码。必须先写 Spec，由 AI 生成基于组件测试的测试用例。**

```
AI 增强版 TDD 循环：
  Spec驱动 → 红灯阶段（AI生成失败测试） → 绿灯阶段（AI编写实现） → 重构阶段
```

---

## 测试优先级

| 优先级 | 测试类型 | 强制性 |
|--------|----------|--------|
| P0 | 组件测试 | **强制** |

> 仅保留组件测试；集成测试和E2E测试跨应用，不在本框架范围内。工具类（Utils 后缀 / 静态方法类）需生成测试。

---

## 组件测试入口约定

根据变更类的类型，分两路执行（v3.14.0 双路分流）：

### 路由 A：ENTRY_LAYER（入口层）

入口层类必须从最外层调用入口发起测试，禁止绕过入口直接测试其下游 Service。

| 入口类型 | 测试入口 | 实现方式 |
|----------|----------|----------|
| HTTP 接口 | Controller 层 | `MockMvc` 发起 HTTP 请求 |
| Dubbo 接口 | Dubbo Facade/接口实现类 | `@Autowired` 注入接口直接调用 |
| MQ 消费者 | MessageListener 入口 | 直接调用 `handle` 方法 |
| Job / Task | Job 实现类 | `@Autowired` 直接调用 `execute()` |

识别规则：

| 入口类型 | 识别方式 |
|----------|----------|
| HTTP Controller | 类上有 `@RestController` / `@Controller` |
| Dubbo Facade | 类上有 `@DubboService`，或类名含 `Facade` |
| MQ Listener | 类上有 `@RocketMQMessageListener` |
| Job | 类名后缀 `Job`/`Task` 且实现 Job 接口（如 `IJob`） |

### 路由 B：COMPONENT（组件层）

非入口层的变更类（Service / Manager / 工具类等）直接 `@Autowired` 注入变更类，调用变更方法，**禁止向上追溯到 Controller/Facade**。

```java
// ✅ COMPONENT 层正确示例
@Autowired
private OrderService target;  // 直接注入变更类

@Test
public void should_xxx_when_yyy() {
    target.changedMethod(params);  // 直接调用变更方法
}
```

---

## 禁止项

```java
// ❌ 禁止（仅 ENTRY_LAYER 场景）：绕过入口层直接测试其下游 Service
orderService.createOrder(...);   // ENTRY_LAYER 场景应从 Controller 或 Dubbo Facade 入口发起

// ❌ 禁止（所有场景）：通过反射调用私有方法
ReflectionTestUtils.invokeMethod(service, "privateMethod", ...);

// ❌ 禁止（所有场景）：COMPONENT 类向上追溯到 Controller/Facade 再发起测试
// 变更类是 Service，不得反向追溯到 Controller 用 MockMvc 发请求
```
