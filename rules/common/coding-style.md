# 编码风格

> 此文件与 Java 规范对齐，定义通用编码原则。
> Java 特定规则见 [java/architecture.md](../java/architecture.md) 和 [java/code-quality.md](../java/code-quality.md)。

---

## 不可变性原则

优先创建新对象而非修改现有对象：

```
// 伪代码
错误：modify(original, field, value)  → 原地修改
正确：update(original, field, value)  → 返回含修改的新副本
```

对集合操作尤为重要：避免在 foreach 中 remove/add，使用 Iterator 或 Stream 收集新结果。

---

## 文件组织

- 高内聚，低耦合
- 典型 200-400 行，最多 800 行
- 按功能/领域组织，而非按类型
- 单个方法 ≤ 200 行（Java BLOCKER 规则）

---

## 错误处理

- 在每一层显式处理错误
- **禁止空 catch 块**（B9 — BLOCKER 项）
- 用户侧提供友好错误消息，服务端记录详细上下文
- 异常日志格式：`log.error("操作描述 param={}", value, e)`

---

## 命名规范（Java）

| 场景 | 规则 | 示例 |
|------|------|------|
| 类名 | UpperCamelCase | `OrderService`, `UserDO` |
| 方法/变量 | lowerCamelCase | `createOrder`, `userId` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| POJO 布尔字段 | 不加 `is` 前缀 | `active`（非 `isActive`）|
| 禁止 | 拼音与英文混用 | 禁止 `getUserXinxi()` |
