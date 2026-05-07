# Java 代码质量规范

> 此文件扩展 [common/git-workflow.md](../common/git-workflow.md)，定义 Java 项目特有的代码提交质量门。
> 规范权威来源：[飞书 Java 开发规范](https://your-domain.feishu.cn/wiki/CYKww0XMyiNqvUkumwoclvPtn3f)（18章）
> 完整18章本地副本：[feishu-java-standards.md](java-standards.md)

---

## ⚠️ Review 范围约束（硬约束，不可绕过）

**Review 范围 = 本次改动的代码，且仅限本次改动的代码。**

```
审查范围：git diff HEAD（或 git diff {base-branch}...HEAD）输出的内容
  ├── 包含：本次新增的类、方法、字段、语句
  ├── 包含：本次修改的行（含上下文理解所需的少量邻近行）
  └── 排除：同一文件中未被本次修改触及的所有已有代码
```

**禁止行为（任何 Review Agent 均不得违反）：**

| 禁止项 | 说明 |
|--------|------|
| 禁止审查同类中已有的、本次未改动的方法 | 即使方法存在问题，超出本次改动范围一律不触及 |
| 禁止审查同类中已有的、本次未改动的字段/常量 | 存量代码不在本次 Review 范围内 |
| 禁止对存量代码发出 BLOCK / WARN | 只有本次改动引入的问题才能触发 BLOCK/WARN |
| 禁止要求重构/优化未改动的历史代码 | 历史代码问题应通过独立技术债任务处理 |

**操作步骤（Review 前必须执行）：**

```bash
# 1. 获取本次改动的文件列表和行范围
git diff --name-only HEAD          # 改动文件清单
git diff HEAD                      # 完整改动内容（含行号）

# 2. 仅对 diff 输出中"+"开头的行（新增/修改行）执行 BLOCKER 扫描和 L0 检查
# 3. 不得扫描"-"行（删除行）或无前缀行（上下文行）中的存量代码问题
```

---

## BLOCKER 快速扫描（第一轮，提交前同步执行）

**扫描范围：仅对 `git diff HEAD` 中本次新增/修改的行（"+" 行）执行以下检查。同文件中未改动的存量代码不在扫描范围内。**

对本次改动涉及的行检查以下 10 项，**发现任意一项立即修复**：

| # | 规则 | grep 检查命令 |
|---|------|-------------|
| B1 | `SELECT *` 查询 | `grep -r "SELECT \*" --include="*.xml" --include="*.java"` |
| B2 | MyBatis `${}` SQL 拼接 | `grep -r '\${' --include="*.xml" --include="*.java"` |
| B3 | `Executors.newXxx()` 创建线程池 | `grep -r "Executors\.new" --include="*.java"` |
| B4 | 手动 `new Thread()` | `grep -r "new Thread(" --include="*.java"` |
| B5 | `@Async` 未指定线程池 | `grep -rn "@Async[^(]" --include="*.java"` |
| B6 | `@Transactional` 在非 public 方法 | 人工检查 Transactional 注解方法的访问修饰符 |
| B7 | 事务内 RPC/HTTP 调用 | 检查 `@Transactional` 方法体内是否含远程调用 |
| B8 | 硬编码密码/AK/SK/Token | `grep -rn 'password\s*=\s*"[^"]' --include="*.java"` |
| B9 | 空 catch 块 | `grep -rn "catch.*{[[:space:]]*}" --include="*.java"` |
| B10 | Redis Key 无 TTL | 检查 `opsForValue().set()` 是否传 TTL 参数 |

---

## L0 强卡规则（Review 时阻塞合并）

> **范围约束**：以下所有规则仅适用于本次改动引入的代码（`git diff` "+" 行）。不得对同类中已有的、本次未修改的代码触发 L0。

### 命名
- 类名必须 UpperCamelCase（DO/BO/DTO/VO/AO 除外）
- 方法名、变量名必须 lowerCamelCase
- 常量必须 UPPER_SNAKE_CASE
- POJO 类布尔字段**禁止**加 `is` 前缀（序列化框架会误解析）
- 禁止拼音与英文混用

### 并发 / 线程
- 禁止手动 `new Thread()`，使用项目统一线程池管理器
- 禁止 `Executors.newXxx()`，使用 `ThreadPoolExecutor` 显式创建
- `@Async` 必须指定线程池名称（如 `@Async("taskExecutor")`）
- 禁止 `SimpleDateFormat` 定义为 static（线程不安全）

### SQL / DB
- 禁止 `SELECT *`（必须指定字段）
- 禁止 JOIN 超过 3 张表
- 禁止 MyBatis `${}` 拼接（使用 `#{}`）
- 禁止使用外键或级联（应在应用层处理）
- 禁止用 `float`/`double` 存储金额（使用 `decimal`）

### Spring Boot 分层
- `@Transactional` 只加在 Service 层 public 方法
- 事务内禁止 RPC/HTTP 远程调用（长事务占连接池）
- Controller 禁止写业务逻辑

### Redis
- 所有 Key 必须设置 TTL（禁止永不过期 Key）
- 先删缓存再更新 DB（应先更新 DB 再删缓存）
- 禁止手写 `SET NX EX` 实现分布式锁（必须使用 Redisson RLock）
- 分布式锁必须在 `finally` 中释放

### MQ
- 消费者逻辑必须实现幂等（DB 状态判断 or Redis SET NX msgId）
- DB 写入 + 发消息必须使用事务消息或本地消息表

### 代码结构
- 单方法 ≤ 200 行
- for 循环嵌套 ≤ 3 层
- if-else 嵌套 ≤ 3 层
- catch 块不能为空（禁止吞异常）
- finally 块中禁止 return 语句

---

## 两轮检查流程

```
Apply 代码
  │
  ├── 第一轮（同步）：B1-B10 BLOCKER 扫描
  │     └── 发现问题 → 立即修复 → 再次扫描
  │
  └── git commit
        │
        └── 第二轮（异步）：java-review-agent 全量 Review
              ├── BLOCK（有 L0）→ 修复 → amend commit → 再次 Review
              ├── WARN（有 L1）→ 记录报告 → 继续 test-spec
              └── PASS         → 继续 test-spec
```

---

## 改动场景速查

| 改动场景 | 必检规则 |
|---------|---------|
| 命名 | 第1章（布尔字段含 is、拼音混用）|
| 集合操作 | 第4章（未指定初始容量、foreach 内 remove）|
| 并发/线程池 | 第5章（Executors、new Thread）|
| SQL/ORM | 第10章（SELECT*、${}、无 gmt_modified 更新）|
| Spring 分层 | 第12章（Controller 含业务逻辑、Transactional 位置错）|
| Redis | 第13章（Key 无 TTL、手写 SET NX EX）|
| MQ | 第14章（消费无幂等、DB写+消息无事务保护）|
| ES 操作 | 第16章（wildcard 前缀模糊、match_all 无过滤）|
| Dubbo/Feign | 第18章（事务内 RPC、无超时设置）|
