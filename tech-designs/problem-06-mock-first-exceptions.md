# 技术方案：mock-first 例外协议

## 背景

dev-workflow 默认采用 mock-first 单元测试策略：所有外部依赖（数据库、第三方接口、消息队列）均 mock，单元测试不依赖真实环境。

但实践中存在若干场景，mock-first 策略会导致测试价值下降甚至无法覆盖真实问题：

1. **数据库查询逻辑复杂**：涉及多表 join、分页、排序时，mock 无法验证 SQL 正确性。
2. **第三方 SDK 行为不确定**：部分 SDK 有内置状态机，mock 难以模拟真实行为。
3. **并发场景**：数据库锁、事务隔离级别等并发问题无法通过 mock 复现。
4. **消息幂等性验证**：消息队列的幂等消费逻辑需要真实消息系统才能验证。

## 目标

1. 定义 mock-first 例外条件，明确哪些场景允许使用真实依赖或 Testcontainers。
2. 设计例外声明协议，让代码生成阶段能识别例外并生成对应的集成测试。
3. 避免例外扩散：例外只允许在"集成测试层"使用，单元测试层强制 mock。

---

## 方案设计

### 例外条件定义

以下场景允许申请 mock-first 例外，在集成测试层使用真实依赖或 Testcontainers：

| 场景 | 例外类型 | 推荐方案 |
| --- | --- | --- |
| 复杂 SQL 查询（join > 2 表，或含动态条件） | DB_INTEGRATION | Testcontainers（H2 / 真实 DB 镜像） |
| 第三方 SDK 内置状态机 | SDK_INTEGRATION | Testcontainers 或 WireMock |
| 数据库事务 / 乐观锁 / 悲观锁 | DB_TRANSACTION | Testcontainers（同上） |
| 消息幂等性 | MQ_INTEGRATION | Testcontainers（RocketMQ/Kafka 镜像） |
| 文件系统操作（非临时文件） | FS_INTEGRATION | 本地临时目录，不需要 Testcontainers |

**明确不允许例外的场景**（必须 mock）：

- 纯业务逻辑计算（无 IO）
- HTTP 接口调用（用 WireMock/MockServer 代替真实调用）
- 外部业务系统接口（永远 mock，不依赖对方环境可用性）

### 例外声明协议

在技术方案的测试策略章节中，显式声明例外：

```yaml
# 技术方案 test_strategy 字段（示例）
test_strategy:
  unit_tests:
    framework: "junit5+mockito"
    mock_strategy: "mock-first"
  integration_tests:
    enabled: true
    exceptions:
      - scope: "OrderRepositoryTest"
        reason: "复杂多表 join 查询，SQL 正确性需真实 DB 验证"
        type: "DB_INTEGRATION"
        tool: "testcontainers-mysql"
      - scope: "MessageConsumerIdempotencyTest"
        reason: "幂等消费逻辑需要真实 RocketMQ 验证"
        type: "MQ_INTEGRATION"
        tool: "testcontainers-rocketmq"
```

代码生成阶段读取 `integration_tests.exceptions`，为每个例外生成：
1. 对应的 Testcontainers 配置类。
2. 集成测试骨架（与单元测试目录分离，放在 `src/test/integration/`）。

### 测试分层目录结构

```
src/
├── test/
│   ├── java/                    # 单元测试，全部 mock-first
│   │   └── com/example/
│   └── integration/             # 集成测试，允许例外
│       └── com/example/
│           ├── OrderRepositoryIT.java
│           └── MessageConsumerIdempotencyIT.java
```

集成测试使用 `@Tag("integration")` 标注，默认不在 CI 快速通道执行，只在专用集成测试任务中执行。

### CI 执行策略

```yaml
# CI 配置示意
jobs:
  unit-test:
    steps:
      - run: mvn test -Dexclude=**/integration/**   # 排除集成测试

  integration-test:
    when: push to main 或手动触发
    steps:
      - run: mvn test -Dinclude=**/integration/**   # 只跑集成测试
```

### 代码生成阶段的例外处理

代码生成 Phase 3 检测到 `integration_tests.exceptions` 时：

```
Step 1: 为每个例外生成 Testcontainers 依赖声明（pom.xml / build.gradle）
Step 2: 生成 @Testcontainers + @Container 配置类骨架
Step 3: 在集成测试目录生成测试骨架
Step 4: 在 execution-state 中记录集成测试的产物路径
```

---

## 文件变更清单

| 文件 | 变更说明 |
| --- | --- |
| 技术方案模板 | 新增 `test_strategy.integration_tests.exceptions` 字段规范 |
| `skills/mrd-to-code-v2/skills/03-code-gen-tdd/SKILL.md` | 新增集成测试例外识别和生成逻辑 |
| `.mrd-to-code-config.json` | 新增 `mock.exceptions_allowed` 配置开关 |

---

## 验收标准

1. 技术方案中声明的集成测试例外，能在代码生成时正确生成 Testcontainers 配置和测试骨架。
2. 单元测试目录中不出现 Testcontainers 依赖，保持 mock-first 纯洁性。
3. 集成测试可独立运行，不依赖外部环境（通过 Testcontainers 自启动容器）。
4. `exceptions` 字段未声明时，代码生成只生成单元测试，不生成集成测试骨架。

---

## 风险与注意事项

1. **例外扩散**：若例外声明标准不严格，容易导致越来越多的测试绕过 mock-first，降低测试隔离性。建议在 Code Review checklist 中增加"新增例外是否合理"检查项。
2. **Testcontainers 启动时间**：Testcontainers 会增加 CI 时间，需在独立 job 中执行，避免影响主干 CI 速度。
3. **本地环境依赖**：Testcontainers 需要本地 Docker，若开发者环境无 Docker 需提供 skip 方案。
