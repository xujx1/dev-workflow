# Java 规范 — 分布式、Elasticsearch、ElasticJob 与 RPC 治理

> 来源：[飞书 Java 开发规范](https://your-domain.feishu.cn/wiki/CYKww0XMyiNqvUkumwoclvPtn3f)，第15-18章
> 索引：[../\_index.md](../_index.md)

---

## 十五、分布式规范

### 分布式 ID

**强制**

- 禁止用数据库自增 ID 作为对外暴露的业务 ID（暴露数据量、易遍历攻击）
- 分布式 ID 使用雪花算法（Snowflake）或公司统一 ID 生成服务
- ID 类型统一用 `Long`，JSON 序列化时转为 `String`（前端 JS 处理超过 53 位整数会精度丢失）

### 分布式事务

**强制**

- 能用本地事务解决的，不引入分布式事务
- 跨服务写操作优先用**最终一致性**方案（本地消息表 + MQ），而不是强一致性（2PC/Seata XA）
- 使用 Seata AT 模式时，涉及的表必须有主键，且 undo_log 表必须建好
- 补偿/回滚逻辑必须有兜底：超时未完成的事务有定时扫描任务补偿

**推荐**

- 分布式事务链路尽量短（≤ 3 个服务），链路越长失败概率越高
- 幂等设计优先于分布式事务设计：下游幂等后，上游重试即可，无需复杂回滚

### 接口幂等

**强制**

- 所有写操作接口（新增、修改、支付、扣减）必须设计幂等
- 幂等实现方案（三选一）：
  1. **唯一索引**：DB 层面防重，捕获 `DuplicateKeyException` 返回成功
  2. **Token 机制**：前端请求前获取 token，提交时携带，服务端用 Redis `SET NX` 校验
  3. **状态机**：只有特定状态才允许操作，CAS 更新状态

**推荐**

- 幂等 Key 的 TTL 设置为业务合理的最大窗口期（如支付 24h，下单 10min）

---

## 十六、Elasticsearch 使用规范

### 索引设计

**强制**

- 索引名称全小写，格式：`业务线_数据类型_版本号`，如 `order_waybill_v1`
- 禁止在生产环境使用动态 Mapping（`dynamic: true`），必须显式定义 Mapping
- 不需要全文检索的字符串字段设置 `index: false`，节省存储和索引开销
- 精确匹配字段（状态、ID、枚举）使用 `keyword` 类型，禁止用 `text`
- 金额/精度字段使用 `scaled_float` 或 `long`（单位：分），禁止用 `float`/`double`
- 每个索引必须设置合理的 `number_of_shards` 和 `number_of_replicas`，禁止依赖默认值

**推荐**

- 冷热数据分离：使用 ILM（Index Lifecycle Management）自动管理索引生命周期
- 大索引采用别名（Alias）机制，方便零停机重建索引

### 查询规范

**强制**

- 禁止在查询中使用 `wildcard` 前缀模糊（`*keyword`），走 `match` 或 `match_phrase`
- 禁止不带任何过滤条件的全量 `match_all` 查询（防止大数据量 OOM）
- 分页查询必须设置 `size` 上限（建议 ≤ 200），深度分页（from > 1000）必须改用 `search_after`
- 聚合查询（Aggregation）的 `size` 必须显式设置，禁止依赖默认值 10

**推荐**

- 优先使用 `filter` 上下文替代 `query` 上下文做精确过滤（filter 有缓存，query 计算相关性得分）
- 需要高亮、评分的场景才用 `query`；纯过滤场景全用 `filter`

### 写入规范

**强制**

- 禁止单条循环写入，批量写入必须使用 `Bulk API`，单批建议 500~1000 条
- 写入失败必须有重试逻辑，重试需幂等（用业务 ID 作为文档 `_id`，天然幂等）
- ES 写入与 DB 写入不在同一事务内，必须用补偿机制（定时对账/Canal 同步）保证一致性

### 客户端使用

**强制**

- 使用 `RestHighLevelClient`（ES 7.x），禁止使用已废弃的 `TransportClient`
- 必须配置连接池参数（`maxConnTotal`、`maxConnPerRoute`）和超时时间（`connectTimeout`、`socketTimeout`）
- 捕获 `ElasticsearchException` 后必须打印索引名、请求参数，方便排查

---

## 十七、ElasticJob 分布式任务规范

**强制**

- 每个 Job 必须实现幂等：同一时间片被重复执行，结果与执行一次相同
- Job 类名必须语义清晰，格式：`Xxx[Daily/Hourly/Minute]Job`，如 `OrderTimeoutMinuteJob`
- Job 的 `shardingTotalCount` 必须与处理能力匹配，禁止设置过大导致分片空转
- Job 执行超时必须设置告警，单次执行时间建议不超过分片间隔的 80%
- Job 内部禁止使用 `Thread.sleep()` 做节流，应缩小每次处理批量或调整调度频率
- Job 执行异常必须捕获并记录日志，禁止异常静默导致任务假成功

**推荐**

- 数据量大的 Job 按分片键（如 `id % shardingTotalCount`）拆分数据范围，避免单节点全量扫描
- Job 执行结果写入监控日志（处理数量、耗时、失败数），方便告警和统计
- 定时对账 Job 与业务 Job 分开部署，避免资源争抢

---

## 十八、Dubbo / Spring Cloud 服务治理规范

### Dubbo RPC

**强制**

- 接口方法返回值统一用 `Result<T>` 封装，禁止直接抛异常给调用方
- 服务接口必须定义超时时间（`timeout`），禁止依赖默认无限等待
- 服务接口必须定义重试次数（幂等接口 `retries=2`，非幂等接口 `retries=0`）
- Provider 端参数必须做校验，不能依赖 Consumer 端已校验
- 服务接口禁止传递 `HttpServletRequest`/`HttpServletResponse` 等容器对象
- 接口升级必须向后兼容：只增参数（设默认值），禁止删除/修改已有参数

**推荐**

- 核心服务配置 Sentinel/Hystrix 熔断降级，防止雪崩
- 接口 `version` 字段用于不兼容升级隔离，同时保留新旧两个版本过渡期

### Spring Cloud / Feign

**强制**

- Feign 客户端必须配置超时时间（`connectTimeout`、`readTimeout`），禁止默认无限等待
- Feign 调用必须有熔断 Fallback，Fallback 实现中禁止再次发起远程调用
- Feign 接口定义的包路径禁止与 Controller 路径冲突，避免 Spring 自动注册为接口实现
- 跨服务调用禁止在 `@Transactional` 事务内（原因：远程调用失败无法回滚本地事务）

**推荐**

- 使用 Spring Cloud 链路传染（TraceId）标准化透传，方便跨服务日志关联
- 灰度/金丝雀发布场景，通过 Header 染色（`X-Gray-Tag`）配合路由规则隔离流量

### 服务注册（Consul）

**强制**

- 服务名称全局唯一，格式：`业务线-服务名`，如 `scp-waybill-center`
- 健康检查接口（`/actuator/health`）必须真实反映服务状态，禁止永远返回 UP
- 服务下线必须主动注销（优雅停机），禁止直接 kill -9 导致流量损失
