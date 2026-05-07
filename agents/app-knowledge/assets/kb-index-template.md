### 第八步：生成 KB_INDEX.md（知识库索引入口）

**目的**：作为知识库的"目录页"，替代全量加载 01~06_*.md。Agent 启动时只读 KB_INDEX.md（≤100行），需要详情时按锚点 Read。

**模板**：

```markdown
# 知识库索引

> 最后更新：{YYYY-MM-DD} | 保鲜周期：{N}个月

## 核心实体

| 实体 | 业务含义 | 详情锚点 |
|------|---------|---------|
| {OrderAggregate} | {订单聚合根} | [01_业务与领域知识层.md#orderaggregate](./01_业务与领域知识层.md#orderaggregate) |

## 核心流程

| 流程 | 触发入口 | 详情锚点 |
|------|---------|---------|
| {订单创建} | {HTTP/Dubbo/MQ} | [03_核心流程与逻辑层.md#订单创建](./03_核心流程与逻辑层.md#订单创建) |

## 关键接口

| 服务 | 接口数 | 详情锚点 |
|------|--------|---------|
| {订单服务} | {N} | [api-index.md#order-service](./api-index.md#order-service) |

## 组件清单

| 类型 | 数量 | 详情锚点 |
|------|------|---------|
| Handler | {N} | [component-index.md#handler](./component-index.md#handler) |
| Consumer | {N} | [component-index.md#consumer](./component-index.md#consumer) |

## 数据库表

| 表名 | 业务用途 | 详情锚点 |
|------|---------|---------|
| {order} | {订单主表} | [db-schema.md#order](./db-schema.md#order) |

## 技术约束

- 枚举类：{N} 个（见 01_业务与领域知识层.md#枚举）
- 异常码：{N} 个（见 04_工程与规范层.md#异常）
```

**生成约束**：

1. **行数限制**：总行数 ≤100 行
2. **锚点格式**：使用 Markdown 链接语法 `[显示文本](./文件名#锚点)`
3. **实体/流程数量**：每个表最多 10 条核心条目，超出时标注"（Top 10）"
4. **锚点命名**：使用小写 + 连字符，如 `#orderaggregate`、`#订单创建`

**与 CONTEXT.md 的区别**：

| 文件 | 行数限制 | 用途 | 加载时机 |
|------|---------|------|---------|
| CONTEXT.md | ≤200行 | 完整上下文摘要 | 始终加载 |
| KB_INDEX.md | ≤100行 | 目录索引 + 锚点链接 | 需要详情时按需 Read |
