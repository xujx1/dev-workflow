# Step 3.5 模式契约校验器（P0）

## 目标

生成测试代码后，校验生成内容是否符合 mock-first 技术栈约束，防止违规代码进入编译阶段。

## 执行时机

在 Step 3（生成产物）完成后、Step 4（编译 gate）之前执行。

## 禁止清单

生成的测试代码中，以下内容**不得存在**：

- `@SpringBootTest`
- `@WebMvcTest`
- `@ExtendWith(SpringExtension.class)`
- `@Autowired`（字段级，非构造注入）
- `@MockBean`
- `@SpyBean`
- `@Transactional`
- `@Rollback`
- `MockMvcBuilders.webAppContextSetup(...)`
- 继承任何 Spring 测试基类（`extends XxxTest` 且需要 Spring 容器）

## 强制要求

- HTTP 场景必须使用 `MockMvcBuilders.standaloneSetup(controller)`
- 非 HTTP 场景必须使用纯 Mockito（`MockitoAnnotations.openMocks()` 或 `MockitoExtension`）
- 所有外部依赖必须通过 `Mockito.mock()` 或 `@Mock` 注入
- 不得要求启动本地服务、容器、真实 DB/Redis

## 校验方法

对每个生成的 `.java` 测试文件执行：

1. 读取文件内容
2. 按禁止清单逐项检查
3. 如发现违反：
   - **自动修正**：移除禁止内容，替换为正确实现
   - 如无法自动修正，标记为错误并中断

### Mockito stub 策略校验（必须执行）

1. 读取 Step 0 的「Mock 依赖方法返回类型映射」
2. 扫描测试代码中所有 `doNothing().when(mock).xxx(...)` 调用
3. 对每个被 `doNothing()` 包裹的方法，在返回类型映射中查找其返回类型
4. 若该方法返回类型**不是** `void`，则判定为违反：
   ```
   ❌ {文件}: doNothing() 用于非 void 方法 {依赖类}.{方法名}
      该方法的返回类型为 {返回类型}，应使用 when(mock.{方法名}()).thenReturn(value)
      修正：替换 doNothing().when(mock).{方法名}() → when(mock.{方法名}()).thenReturn({合理默认值})
   ```
5. 自动修正所有违反项后重试校验，确保无残留

## 输出

校验通过后，输出摘要：
```
模式校验通过：{N} 个测试类，mock-first 模式
```

校验失败时，输出：
```
模式校验失败：
- {文件}: {违反项} → {修正动作或错误}
```

## 自动修正策略

- 发现 `@SpringBootTest` / `@WebMvcTest` → 替换为 `MockMvcBuilders.standaloneSetup(...)` + `Mockito.mock()`
- 发现 `@MockBean` → 替换为 `@Mock` + `MockitoAnnotations.openMocks(this)`
- 发现 `@ExtendWith(SpringExtension.class)` → 替换为 `MockitoExtension`（如仓库存在）或移除
- 发现 `doNothing()` 用于非 void 方法 → 替换为 `when(mock.method()).thenReturn(合理默认值)`

## 中断条件

- 无法自动修正的模式违反
- 生成的测试代码完全不符合 mock-first 要求
