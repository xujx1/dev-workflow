# 测试覆盖率与 CI/CD 规范

> 仓库级测试规约分片。用于约束覆盖率铁律、门禁口径与 CI/CD 最小接入方式。

---

## 覆盖率铁律

> ⛔ **绝对禁令（最高优先级，不可绕过）**：
>
> AI 在生成测试代码过程中，严禁以任何形式修改开发代码（`src/main/java` 下的任何文件）。
> 即使修改的目的是“提升测试覆盖率”，也绝对不允许。

### 禁止行为

| 禁止行为 | 说明 |
|----------|------|
| 为私有方法加 `protected` | 让测试代码可以直接调用，本质是破坏封装 |
| 为字段加 `public` setter | 方便 DataFactory 赋值，绕过业务约束 |
| 为类添加 `@VisibleForTesting` 并降低访问权限 | 以测试为由改变生产代码结构 |
| 新增无业务意义的构造函数或工厂方法 | 仅为测试存在的代码会污染生产逻辑 |
| 修改 `final`、`private`、`static` 等修饰符 | 改变设计意图以迎合测试工具 |
| 抽取接口或父类仅为了 Mock | 没有业务驱动，纯粹为测试改架构 |
| 删除或简化生产代码分支 | 为覆盖率数字作弊，丢失业务逻辑 |

### 正确做法

```text
当覆盖率不足时：
  ✅ 补充更多测试场景（新增 @Test 方法）
  ✅ 完善 DataFactory 数据构造，覆盖更多路径
  ✅ 通过入口发起不同参数的请求，触达更多分支
  ✅ 向用户说明哪些代码路径难以覆盖及原因

  ❌ 不修改任何 src/main/java 下的文件
  ❌ 不因为“反射限制”而放宽生产代码访问权限
  ❌ 不因为“分支太多”而删减生产逻辑
```

---

## 最低覆盖率标准

| 测试类型 | 行覆盖率 | 分支覆盖率 | 强制性 |
|----------|----------|------------|--------|
| 组件测试（全量） | — | — | 不作硬性要求，仅供参考 |
| 新增代码（增量） | ≥ 80% | ≥ 80% | 强制 |

## 覆盖率前置要求

在进入 Phase 4 / Phase 5 前，必须先完成一次 **coverage intent 校验**：

- 若已有 `change-manifest-phase2.md` 或等价变更摘要，需确认关键新增入口、分支、消息字段、映射字段均已有测试场景映射
- 该校验属于“场景完整性检查”，**不是**伪造真实覆盖率数字
- 若发现明显缺口，优先补 `test_spec`，而不是默认进入 `phase4` / `phase5` 后靠多轮 Runner 试错

## 覆盖率排除规则

```xml
<excludes>
    <exclude>**/config/**</exclude>
    <exclude>**/dto/**</exclude>
    <exclude>**/entity/**</exclude>
    <exclude>**/*Application.java</exclude>
</excludes>
```

---

## CI/CD 集成要求

### 测试执行流程

```yaml
# .github/workflows/test.yml
name: Test Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'

      - name: Run Tests
        run: ./gradlew test

      - name: Generate Coverage Report
        run: ./gradlew jacocoTestReport

      - name: Check Coverage Threshold
        run: ./gradlew jacocoTestCoverageVerification

      - name: Upload Coverage Report
        uses: codecov/codecov-action@v3
```

### 测试门禁

```markdown
# PR 合并门禁

## 必须满足的条件

- [ ] 所有测试通过
- [ ] 新增代码增量行覆盖率 ≥ 80%，增量分支覆盖率 ≥ 80%
- [ ] 无新增 SonarQube 严重问题
- [ ] 组件测试全部通过
- [ ] 无测试数据残留（事务回滚验证）

## AI 自动检查

AI 在生成代码后会自动:
1. 运行所有测试
2. 检查覆盖率报告
3. 验证测试数据隔离
4. 生成测试报告

### 故障归类补充

- `runner_asset_failure`（覆盖率脚本、缓存、classpath、参数契约故障）**不算**覆盖率失败
- 只有测试全绿且覆盖率口径成功产出后，低于阈值的结果才算 `coverage_below_threshold`
```
