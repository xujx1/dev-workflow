# Java 规范 — 安全、Redis 与 MQ

> 来源：[飞书 Java 开发规范](https://your-domain.feishu.cn/wiki/CYKww0XMyiNqvUkumwoclvPtn3f)，第11章、第13-14章
> 索引：[../\_index.md](../_index.md)

---

## 十一、安全规范

**强制**

- 用户个人页面/功能必须做权限校验（水平权限）
- 用户敏感数据展示必须脱敏
- SQL 参数必须参数绑定，禁止字符串拼接 SQL
- 所有用户输入必须做有效性验证（防 OOM、慢查询、SQL 注入、ReDoS）
- HTML 页面输出用户数据必须转义
- 表单/AJAX 提交必须 CSRF 过滤
- 短信/邮件/支付等平台资源必须防重放（数量限制 + 频率控制 + 验证码）

---

## 十三、Redis 使用规范

### Key 设计

**强制**

- Key 命名格式：`业务名:模块名:唯一标识`，用冒号分隔，全小写
  - 正例：`order:detail:123456`、`user:token:uid_789`
  - 反例：`orderDetail123456`、`ORDER_DETAIL_123456`
- 所有 Key 必须设置 TTL，禁止写入永不过期的 Key（防内存泄漏）
- 单个 Key 对应的 Value 不超过 10KB；大对象（>100KB）禁止存 Redis

### 缓存使用

**强制**

- 缓存与 DB 的一致性策略：**先更新 DB，再删除缓存**（Cache-Aside），禁止先删缓存再更新 DB
- 缓存击穿防护：热点 Key 用互斥锁（分布式锁）保护，只允许一个线程回源 DB
- 缓存穿透防护：查询结果为空时也要缓存空值（TTL 设短，如 60s），或用 BloomFilter 前置过滤
- 缓存雪崩防护：批量 Key 的 TTL 加随机偏移（基础 TTL ± 随机秒数），避免同时失效
- 禁止在循环内逐条操作 Redis，批量操作用 `pipeline` 或 `mget/mset`

**推荐**

- 热点数据 TTL 建议：用户 Session 30min，商品详情 5~10min，配置类数据 1h
- `@Cacheable` 等注解缓存须显式指定 `key` 和 `cacheNames`，禁止依赖默认生成 key

### 分布式锁

**强制**

- 必须使用 Redisson `RLock`，禁止手写 `SET NX EX` 实现分布式锁（释放逻辑易出错）
- 加锁必须设置超时时间（`leaseTime`），防止死锁
- 释放锁必须在 `finally` 块中执行，且判断是否持有锁后再释放：

```java
RLock lock = redissonClient.getLock("lock:order:" + orderId);
boolean locked = lock.tryLock(3, 10, TimeUnit.SECONDS);
try {
    if (!locked) throw new BizException("系统繁忙，请稍后重试");
    // 业务逻辑
} finally {
    if (lock.isHeldByCurrentThread()) {
        lock.unlock();
    }
}
```

- 锁的 Key 必须包含业务唯一标识，禁止使用全局大锁（如 `lock:order`）
- 分布式锁内禁止进行远程调用或数据库事务（持锁时间越短越好）

### 计数 / 限流

**强制**

- 计数操作用 `INCR`/`INCRBY`，禁止先 GET 再 SET（非原子，并发会丢数据）
- 限流逻辑使用 Lua 脚本保证原子性，或使用 Redisson `RRateLimiter`
- 排行榜使用 `ZSet`，score 存时间戳或分值，禁止用 List 模拟排序

### Session / Token

**强制**

- Token 写入 Redis 时必须同时设置 TTL，且 TTL 与业务过期时间一致
- 用户登出时必须主动删除 Redis 中的 Token Key，禁止只依赖 TTL 过期
- 多端登录场景下，Key 中需包含设备标识：`user:token:uid_123:app`

---

## 十四、MQ 使用规范（RocketMQ / Kafka）

### 生产者

**强制**

- 消息体必须是可序列化对象，禁止直接传 Java 对象引用或 `Object` 类型
- 消息 body 使用 JSON 序列化，字段命名保持稳定（新增字段兼容，禁止删除/重命名字段）
- 发送消息失败必须有重试逻辑，同步发送至少重试 3 次
- 消息 Key 使用业务唯一 ID（如订单号），方便消息轨迹查询和去重
- 涉及 DB 写入 + 发消息的场景，必须使用事务消息或本地消息表，保证两者一致性

**推荐**

- 单条消息 body 不超过 512KB
- 批量场景用批量发送接口，减少网络往返

### 消费者

**强制**

- 消费逻辑必须保证**幂等性**：同一条消息被重复消费，结果与消费一次相同
  - 实现方式：消费前查 DB 状态判断是否已处理；或用 Redis `SET NX` 做消息去重（Key = msgId，TTL = 24h）
- 消费者禁止抛出未捕获异常导致消费卡住，必须 try-catch 并根据异常类型决定：
  - 可重试异常（网络抖动、DB 超时）：抛出让 MQ 重投
  - 不可重试异常（数据格式错误、业务逻辑拒绝）：记录日志 + 入死信队列，返回消费成功
- 消费者处理时间不超过 MQ 的消费超时阈值（RocketMQ 默认 15min），耗时操作异步处理
- 死信队列必须有监控告警，并有人工介入处理流程

**推荐**

- 消费者业务逻辑用 `messageId` 作幂等 Key，优先于用业务 ID（业务 ID 可能重复）
- 消费者并发度与下游（DB/Redis）承载能力匹配，避免消费过快压垮下游

### 消息设计

**强制**

- Topic 按业务域划分，禁止多业务混用一个 Topic
- 消息字段必须向后兼容：只增字段，不删字段，不改字段类型
- 消息体中禁止存放大对象（图片、文件等），只存 ID 引用
