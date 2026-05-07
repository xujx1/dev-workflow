# 03 核心流程与逻辑层

> 证据：application/handler、mq/consumer、job 包；注解与基类静态分析；**无**运行时链路数据。

## 流程编排

- **规模**：{N} 个类标注 `@{FlowControl 或等价注解}`
- **基类**：`{AbstractFlowHandler}<IP,IR>`，顺序执行 `unitCollection` 中的 `{IHandlerUnit}` 实现
- **典型示例**：`{MainFlowHandler}` 负责{业务流程}，unitCollection 包含{Unit1}、{Unit2}…

### 按业务域归类

| 域 | 代表 Handler | 语义 |
|----|-------------|------|
| {域1} | `{HandlerA}` | {职责} |
| {域2} | `{HandlerB}` | {职责} |
| {域3} | `{HandlerC}` | {职责} |

## MQ 消费者

- **规模**：`*Consumer*.java`（main）{N} 个
- **基类模式**：`{BaseMqConsumer}` extends `{BaseDmqProcessor}`，构造注入 `{BaseMqConfig}`
- **实现入口**：覆写 `{handle/doConsume}(Message, ConsumeContext)` 方法

### 子目录规模

| 子包 | 文件数（约） | 主题 |
|------|-------------|------|
| `{subpkg1}/` | {N} | {职责} |
| `{subpkg2}/` | {N} | {职责} |

## 定时任务

### {DJob / @DJobComponent}

- **数量**：{N} 个，实现 `{TaskHandler}`

### Elastic-Job / {其他调度}

- **数量**：{N} 个 `implements SimpleJob`
- **代表**：`{XxxJob}` 负责{职责}

### 其他调度

- `@Scheduled`：{N} 处（含{缓存刷新/统计等}）

## 关键状态与异步

- **领域事件**：`{DomainEventProcessJob}` + 事件仓储，异步表驱动处理 **[待确认]** 与消息关系
- **{其他异步机制}**：{简述}

---

## Agent 代码生成约束

- {约束1：如"新增编排流程 → 继承 AbstractFlowHandler，添加 @FlowControl 声明 unitCollection"}
- {约束2：如"新增 MQ 消费者 → 优先继承 BaseMqConsumer，实现 handle() 返回合适 Action"}
- {约束3：如"禁止在应用层随意新建线程池处理 Job/MQ"}
