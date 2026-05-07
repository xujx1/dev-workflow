# Java DDD 分层规范

> 此文件定义 Java/Spring Boot 项目的分层约定。
> 与飞书规范第12章对齐：[飞书 Java 开发规范](https://your-domain.feishu.cn/wiki/CYKww0XMyiNqvUkumwoclvPtn3f)
> 完整18章本地副本：[feishu-java-standards.md](java-standards.md)

---

## 标准分层结构

```
{service}-interfaces/       ← Controller、Dubbo/gRPC 实现
{service}-application/      ← Application Service、Handler、Unit
{service}-domain/           ← 领域对象、领域服务、领域事件
{service}-infrastructure/   ← Mapper、外部 Client、MQ Producer
```

---

## 分层职责硬约束

```
Controller   → 参数校验、协议转换，禁止写业务逻辑
Service      → 业务逻辑编排，@Transactional 所在层
Manager      → 通用能力下沉（缓存、三方封装、多 DAO 组合）
DAO/Mapper   → 只做数据读写，禁止包含业务判断
```

---

## 接口设计规范

- 统一返回 `Result<T>` 封装
- 入参 > 2 个字段时封装为 DTO
- 禁止用 `Map` 作为接口参数
- Dubbo 非幂等接口 `retries` 设为 0
- 外部 HTTP/RPC 调用必须配置超时

---

## 事务规范

```java
// 正确：Service 层 public 方法
@Service
public class OrderService {
    @Transactional
    public void createOrder(CreateOrderDTO dto) {
        // 只允许 DB 操作，禁止远程调用
        orderMapper.insert(order);
        inventoryMapper.deductStock(order.getItemId(), order.getQty());
    }
}

// 错误1：Controller 层加事务
@RestController
public class OrderController {
    @Transactional  // ❌ 禁止
    public Result<Void> createOrder(...) { }
}

// 错误2：事务内 RPC 调用
@Transactional
public void createOrder(...) {
    orderMapper.insert(order);
    inventoryRpcClient.deduct(...);  // ❌ 事务内禁止远程调用
}
```

---

## 异常处理规范

- Service 层：捕获并包装为业务异常（`BizException`），含 errorCode
- Controller 层：通过统一异常处理器 `@ControllerAdvice` 转换为 `Result<T>`
- 禁止空 catch 块
- 异常日志必须包含现场参数：`log.error("msg={}", param, e)`

---

## Redis Key 规范

```
格式：{业务名}:{模块名}:{唯一标识}
示例：{app}:order:lock:12345678
      {app}:user:session:uid_001
```

- 冒号分隔（与 Redis 命名空间约定一致）
- 必须设置 TTL
- 分布式锁使用 Redisson RLock，finally 中释放
