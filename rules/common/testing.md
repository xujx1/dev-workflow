# 测试规范

## 最低测试覆盖率：80%

**必须包含三类测试**：

1. **单元测试** — 领域对象、工具类、业务逻辑方法
2. **集成测试** — Service 层（含 DB）、RPC 接口
3. **用例驱动测试** — 关键业务流程的 E2E 路径验证

---

## TDD 工作流（强制）

```
1. 先写测试（RED）
   - 理解需求，编写失败的测试用例

2. 实现代码（GREEN）
   - 写最小化实现，使测试通过

3. 重构优化（IMPROVE）
   - 在测试保护下重构代码质量

4. 验证覆盖率
   - mvn test jacoco:report
   - 确认 80%+ 行覆盖率
```

---

## 测试命名规范

```java
// 格式: should_{预期结果}_when_{场景条件}
@Test
void should_throw_when_stock_insufficient() { }

@Test
void should_deduct_points_when_order_paid() { }
```

---

## 测试 Agent 支持

使用 **tdd-guide** Agent 时：
- 主动用于新功能开发（无需用户提示）
- Bug 修复前先写复现测试
- 重构前确认测试覆盖率已达 80%

使用 **tdd-test-spec-agent**：
- 输入技术方案 → 生成正式测试规格文档
- 在 Stage 3 / Phase 1 触发，先于实现代码与测试代码
- 产出路径：`{feature_dir}/test_spec.md`
- `test_spec` 正式内容只能由 `tdd-test-spec-agent` 生成，禁止 Skill / orchestrator 直接写正文
- 全流程生成与单独调用生成必须使用同一套模板与格式规则，禁止用 trace / 分析稿替代正式 `test_spec`

---

## 测试失败处理

1. 使用 **tdd-guide** Agent 分析失败原因
2. 检查测试隔离（数据库状态、Mock 是否正确）
3. **修复实现**而非修改测试（除非测试本身有误）
4. 确认修复不破坏其他测试
