# 测试数据工厂模式

> 仓库级测试规约分片。

---

## 说明

当前测试模式固定为 **mock-first**（JUnit4 + Mockito），不使用 TestDataFactory。

所有测试数据通过 Mockito `when().thenReturn()` 构造，禁止：
- 生成 `TestDataFactory` 类
- 使用 `@Autowired` 注入 Mapper 写库
- 直接 INSERT 数据库

数据构造参考 `05-code-gen-rules.md` 中的 Mock 规范。
