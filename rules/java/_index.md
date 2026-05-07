# Java 规范索引（按需加载）

> 类似应用知识库的按需路由设计：agent 先读本文件，根据任务类型决定加载哪些规范文件，
> 避免一次性加载全量规范消耗 token。

---

## 规范文件目录

| 文件 | 涵盖内容 | 适用任务 |
|------|---------|---------|
| `standards/01-naming-oop.md` | 第1章命名规范、第2章常量定义、第3章OOP规约 | 任何代码生成 |
| `standards/02-collection-concurrency.md` | 第4章集合处理、第5章并发处理 | 涉及集合操作 / 线程池 / 并发控制 |
| `standards/03-style-exception-log.md` | 第6章控制语句、第7章注释规范、第8章异常处理、第9章日志规范 | 代码规范检查 |
| `standards/04-mysql-spring.md` | 第10章MySQL/ORM、第12章Spring Boot分层规范 | 涉及 DB 操作 / Controller-Service-DAO |
| `standards/05-redis-mq.md` | 第11章安全规范、第13章Redis使用规范、第14章MQ使用规范 | 涉及 Redis / RocketMQ / Kafka |
| `standards/06-distributed-es-rpc.md` | 第15章分布式规范、第16章ES使用规范、第17章ElasticJob规范、第18章Dubbo/SpringCloud规范 | 涉及分布式事务 / ES / RPC 治理 |
| `standards/07-architecture.md` | DDD 分层结构、接口设计规范、事务规范、Redis Key 规范 | 新增功能、重构分层、项目模块设计 |
| `standards/08-code-quality-gate.md` | B1-B10 BLOCKER 扫描命令、L0 强卡规则、两轮检查流程 | 代码生成、Review、提交前检查 |

---

## 任务类型 → 推荐加载文件

| 任务类型 | 必读文件 | 按需文件 |
|---------|---------|---------|
| 新增 Controller / Service / DAO | `standards/07-architecture.md` + `standards/01-naming-oop.md` | `standards/04-mysql-spring.md` |
| 涉及 Redis 操作 | `standards/05-redis-mq.md` | `standards/08-code-quality-gate.md`（Redis BLOCKER） |
| 涉及 MQ 消息 | `standards/05-redis-mq.md` | `standards/07-architecture.md`（事务边界） |
| 涉及 MySQL / MyBatis | `standards/04-mysql-spring.md` | `standards/07-architecture.md` |
| 涉及并发 / 线程池 | `standards/02-collection-concurrency.md` | — |
| 涉及 Dubbo / Feign | `standards/06-distributed-es-rpc.md` | `standards/07-architecture.md` |
| 涉及 ES 搜索 | `standards/06-distributed-es-rpc.md` | — |
| BLOCKER 扫描 / Code Review | `standards/08-code-quality-gate.md` | 按改动范围选对应 standards/ |
| 异常处理 / 日志 | `standards/03-style-exception-log.md` | — |

---

## 加载规则（agent 使用说明）

1. **默认**：每次任务先读本 `_index.md`，根据任务类型查表，只 Read 相关文件
2. **BLOCKER 扫描时**：必读 `standards/08-code-quality-gate.md`，同时按改动涉及的领域补充对应 `standards/` 文件
3. **同一会话内已读文件不重复读取**
4. **全量规范原文**：如需访问 18 章完整原文，访问飞书原文（`java-standards.md` 已删除，内容由 `standards/` 八文件覆盖）

---

## 飞书原文

https://your-domain.feishu.cn/wiki/CYKww0XMyiNqvUkumwoclvPtn3f
