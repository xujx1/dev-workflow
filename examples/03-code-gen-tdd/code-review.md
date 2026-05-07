# 代码审查报告 — 当面开箱拍照签收（carrier）

> 审查时间：2026-04-10
> 飞书原文：https://your-domain.feishu.cn/wiki/BiT5w5jJsil91ekSkI8cq7JfnHg
> 审查 Agent：java-review-agent
> 规范基线：rules/java/standards/

---

## 审查结论

**整体评级：通过（有中优先级建议）**

高优先级问题：0 个
中优先级问题：3 个
低优先级/建议：2 个

---

## 高优先级问题（必须修复）

> 无

---

## 中优先级问题（建议修复）

### M-01：MQ 发送失败时缺少补偿机制

**位置**：`SignSubmitServiceImpl.java:L89`

**问题**：签收记录已写库，但 MQ 发送失败后仅记录日志，没有异步重试或本地消息表兜底。若 MQ 持续故障，履约域将永久无法感知签收状态。

**建议**：引入本地消息表或利用 RocketMQ 事务消息，确保签收记录与 MQ 消息最终一致。

---

### M-02：OSS 预签名 URL 有效期配置化

**位置**：`SignPhotoPresignServiceImpl.java:L45`

**问题**：有效期 3600 秒硬编码，后续调整需重新上线。

**建议**：提取到 `application.yml` 中，通过 `@Value` 注入：

```yaml
carrier:
  sign:
    presign-expire-seconds: 3600
```

---

### M-03：查询接口缺少入参 orderId 长度校验

**位置**：`SignQueryController.java:L32`

**问题**：orderId 未做最大长度限制，超长字符串可能导致数据库查询异常。

**建议**：添加 `@Size(max=64)` 注解或在 Service 层做前置校验。

---

## 低优先级建议

### L-01：signId 生成逻辑建议抽取工具类

**位置**：`SignSubmitServiceImpl.java:L56`

当前使用 `UUID.randomUUID().toString().replace("-", "")` 内联生成，建议抽取到 `IdGenerator` 工具类，便于后续统一替换为雪花算法。

### L-02：日志级别优化

**位置**：`SignSubmitServiceImpl.java:L102`

MQ 发送成功的日志级别为 `warn`，应改为 `info`，避免日常运行产生大量 warn 告警。

---

## 通过项

- ✅ 命名规范符合 DDD 分层约定（Service/Impl/Controller/DO/DTO）
- ✅ 异常体系使用 `BizException + BizErrorCode` 统一封装
- ✅ 幂等设计正确，通过数据库唯一键 + `DuplicateKeyException` 捕获实现
- ✅ 接口入参均有 `@NotNull` / `@NotBlank` 校验
- ✅ 数据库操作使用 `@Transactional`，事务范围合理
- ✅ 无 SQL 注入风险（使用 MyBatis 参数化查询）
- ✅ OSS key 路径做了非法字符过滤
