# Apache Dubbo 测试环境约束

> 仓库级测试规约分片。针对使用 Apache Dubbo 的工程，定义组件测试中的特殊处理规则。

---

## Dubbo mock-first 处理原则

mock-first 模式下，所有 Dubbo 依赖（`@DubboReference` 字段、XML Bean）均通过 `@Mock` 注入，**不**启动真实 Dubbo 上下文。

