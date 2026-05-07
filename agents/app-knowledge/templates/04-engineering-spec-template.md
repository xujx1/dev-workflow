# 04 工程与规范层

> 证据：根目录 CLAUDE.md、pom.xml、异常体系与 MQ 基类源码；**无**完整配置中心导出。

## 仓库级强约束（CLAUDE.md 摘要）

- **命名/格式**：{如驼峰、常量全大写、大括号换行、120列、4空格缩进}
- **禁止**：{如随意新建线程池；@Async 不指定线程池；SQL SELECT *；selectByExample；@DubboService}
- **数据表规约**：{如 id/create_time/update_time/is_del 必含字段}

## 异常体系

| 类型 | 位置（示例） | 用途 |
|------|-------------|------|
| `{BizException}` | `{包路径}` | {业务失败，流程中断} |
| `{ExceptionEnum}` | `infrastructure/enums/` | {系统/参数类错误码} |
| `{DomainExceptionEnum}` | `{包路径}` | {领域异常枚举} |
| {子域异常枚举} | `{包路径}` | {子域错误语义} |

## MQ 基类与配置

- `{BaseMqConfig}`：`groupId / topic / tag / groupNs / topicNs`
- `{BaseMqConsumer}`：构造将参数传入父类，注册日志打印
- 子类通过 Spring `@Bean` 或配置类注册消费者

## 流程基础设施

- `{FlowControl} + {FlowMode}`：决定使用哪种执行链实现
- `{AbstractFlowHandler}`：双重检查锁构建链，`doExecute` 由子类实现

## 配置与开关（示例，非全量）

- `{config.switch.xxx}`：{用途，如"下单流程开关"}
- `{config.thread.num}`：{用途，如"MQ 消费者线程数"}
- 配置载体：{如 application.yml / Nacos / Apollo} **[待确认]** 当前环境标准

## 测试与质量

- 测试框架：{如 Spock / PowerMock / H2 / DBUnit}
- 覆盖率门槛：**[待确认]**

---

## Agent 代码生成约束

- {约束1：如"异常 → 优先使用已有枚举 + BizException 模式，不引入无码异常字符串"}
- {约束2：如"MQ → 配置继承 BaseMqConfig，Topic/Tag 常量避免魔法字符串"}
- {约束3：如"日志 → log.info/log.warn 为主，log.error 仅限告警约定场景"}
- {约束4：如"配置 → 新增开关必须带默认值，禁止硬编码环境 URL/密钥"}
