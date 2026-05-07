# 测试规格

## 测试策略

全部使用 mock-first 模式：JUnit4 + Mockito，Mock 所有外部依赖（DB/Redis/RPC），不依赖真实容器。

## 测试用例

### {模块名} 测试

| ID | 用例名 | 类型 | 覆盖方法 | 前置条件 | 验证点 |
|----|--------|------|---------|---------|--------|
| TC001 | 正常流程_成功 | M | {method} | 数据准备 | 返回预期结果 |
| TC002 | 异常处理_{场景} | EX | {method} | 异常条件 | 抛出预期异常 |
| TC003 | 边界条件_{场景} | EX | {method} | 边界值 | 正确处理边界 |

## 覆盖率意图

- **目标覆盖率**：≥80%
- **重点覆盖方法**：{列出核心方法}
- **豁免方法**（如有）：{列出无需覆盖的 getter/setter 等}

## 测试数据准备

### 公共测试数据

```sql
-- 测试用户
INSERT INTO user (id, name, status) VALUES (1, 'test_user', 'ACTIVE');
```

### Mock 配置

```java
// 外部服务 Mock 示例
when(externalService.call(any())).thenReturn(mockResponse);
```

## 验收标准

- [ ] 所有 M 类型用例通过
- [ ] 所有 EX 类型用例通过
- [ ] 覆盖率达到目标值
- [ ] 无新增 SonarQube 问题
