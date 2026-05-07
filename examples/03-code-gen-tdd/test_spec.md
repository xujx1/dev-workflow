# 测试规格文档 — 当面开箱拍照签收（carrier）

> 生成时间：2026-04-10
> 飞书原文：https://your-domain.feishu.cn/wiki/SNEgwMblLiFx7Skmv16cJVjcnYk
> 测试模式：mock-first

---

## test_spec 概览

| 测试类 | 测试数 | 模式 | 覆盖目标 |
|---|---|---|---|
| SignSubmitServiceImplTest | 6 | mock-first | 签收提交主流程 + 幂等 |
| SignPhotoPresignServiceImplTest | 3 | mock-first | OSS预签名URL生成 |
| SignQueryServiceImplTest | 4 | mock-first | 签收记录查询 |

---

## SignSubmitServiceImplTest

### TC-01：正常签收提交
- **前置**：carrier_sign_record 表为空
- **输入**：`orderId=O001, signTime=1745000000, photoKeys=["k1.jpg"], courierId=C001`
- **Mock**：`signRecordMapper.insert` 返回成功；`mqProducer.send` 返回成功
- **预期**：返回 signId 非空；`duplicate=false`；`mqProducer.send` 被调用 1 次

### TC-02：重复提交（幂等）
- **前置**：carrier_sign_record 已有 orderId=O001 + signTime=1745000000 记录
- **输入**：同 TC-01
- **Mock**：`signRecordMapper.insert` 抛出 `DuplicateKeyException`；`signRecordMapper.queryByOrderIdAndSignTime` 返回已有记录
- **预期**：返回已有 signId；`duplicate=true`；`mqProducer.send` **不**被调用

### TC-03：照片数量超限（>5张）
- **输入**：`photoKeys` 包含 6 个元素
- **预期**：抛出 `BizException(BizErrorCode.PHOTO_COUNT_EXCEEDED)`

### TC-04：OSS key 格式校验失败
- **输入**：`photoKeys=["../hack.jpg"]`（非法路径）
- **预期**：抛出 `BizException(BizErrorCode.INVALID_PHOTO_KEY)`

### TC-05：MQ 发送失败（降级处理）
- **Mock**：`mqProducer.send` 抛出 `MqSendException`
- **预期**：签收记录已入库；异常被捕获记录告警日志；返回 signId（不抛出业务异常）

### TC-06：orderId 为空
- **输入**：`orderId=null`
- **预期**：抛出 `IllegalArgumentException` 或 `BizException(PARAM_INVALID)`

---

## SignPhotoPresignServiceImplTest

### TC-07：正常生成预签名URL
- **输入**：`orderId=O001, fileCount=3, fileType=jpg`
- **Mock**：`ossClient.generatePresignedUrl` 返回合法 URL
- **预期**：返回 3 个 uploadUrl；每个 URL 包含 orderId 路径前缀

### TC-08：fileCount 超限
- **输入**：`fileCount=6`
- **预期**：抛出 `BizException(PHOTO_COUNT_EXCEEDED)`

### TC-09：OSS 客户端异常
- **Mock**：`ossClient.generatePresignedUrl` 抛出 `OSSException`
- **预期**：包装为 `BizException(OSS_PRESIGN_FAILED)` 抛出

---

## SignQueryServiceImplTest

### TC-10：按 orderId 查询，有记录
- **Mock**：`signRecordMapper.queryByOrderId` 返回 1 条记录
- **预期**：返回正确的 signId 和 photoUrls（URL 已经过签名转换）

### TC-11：按 orderId 查询，无记录
- **Mock**：`signRecordMapper.queryByOrderId` 返回空列表
- **预期**：返回空列表，不抛出异常

### TC-12：分页参数验证（pageNo=0）
- **输入**：`pageNo=0`
- **预期**：抛出 `IllegalArgumentException`

### TC-13：photoUrl 签名过期转换
- **Mock**：记录中 photoKey 为 OSS key，`ossClient.generatePresignedUrl` 返回带签名 URL
- **预期**：返回的 photoUrls 均为带签名的访问 URL（非原始 key）
