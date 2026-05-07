# Java Review 检查清单与执行详情

> 本文件由 `java-review-agent.md` 骨架按需 Read。

## 规范权威来源

| 优先级 | 来源 | 说明 |
|-------|------|------|
| P0 | `rules/java/_index.md` → 按需加载 `rules/java/standards/01~08.md` | **必须首先加载** |
| P1 | 飞书规范文档（见 `_index.md` 链接） | 与 P0 互补 |
| P2 | `app-knowledge-base/04_工程与规范层.md` | 项目本地规范快照 |
| P3 | `agents/java-review/assets/review-checklist.md` | 离线兜底清单 |

## 上下文加载规则

1. 读 `rules/java/_index.md`（**强制，第一步**）
2. 根据改动范围按需加载 `rules/java/standards/` 对应文件
3. BLOCKER 扫描必读 `rules/java/standards/08-code-quality-gate.md`
4. 读 `app-knowledge-base/04_工程与规范层.md`
5. 若涉及业务逻辑，读 `app-knowledge-base/biz-knowledge/modules/{相关模块}.md`
6. 若涉及 DB/SQL，读 `app-knowledge-base/db-schema.md`（若存在）
7. 若 `{feature_dir}/tech-design.md` 存在，优先读取「附录II：变更影响分析」
8. 若 `l3_gitnexus=available`，读 `agents/java-review/assets/gitnexus-steps.md` 并执行

## 执行流程

```
Step 1: 读 rules/java/_index.md（强制）
Step 2: GitNexus 调用链分析（仅 l3_gitnexus=available 时，读 assets/gitnexus-steps.md）
Step 3: 读 assets/review-checklist.md，执行 L0 BLOCKER 扫描
Step 4: L1/L2/L3 检查
Step 5: Review 报告落盘
```

## 执行模式

### 模式 A：串行 Review
- 只负责问题发现、报告落盘、返回 `review_result`
- 即使发现 `BLOCK`，**不得**直接拉起 `java-impl-agent`
- 报告落盘路径：`{feature_dir}/code-review.md`（**禁止**创建 `review/` 子目录或添加 phase 后缀）

## 输出格式

```
## Review 结论：[BLOCK / WARN / PASS]
规范基准：{规范来源}
Review 范围：{被 Review 的文件/模块列表}

### L0 问题（BLOCK - 必须修复）
| # | 位置（文件:行号） | 规则 | 问题描述 | 修复建议 |
### L1 问题（强烈建议修复）
| # | 位置 | 规则 | 问题描述 | 修复建议 |
### L2/L3 问题（建议）
| # | 位置 | 问题描述 |
### 结论说明
```

报告完成后，在文件末尾追加元数据尾注：
```
---
> **生成元数据**
> 工具：dev-workflow v{skill_root}/VERSION | Skill: java-review v2.1.0
> 生成时间：{YYYY-MM-DD HH:mm}
> Review 范围：{feature_name} — {N} 个文件变更
```

## 计时规范

遵循 `rules/common/timing-spec.md`。报表子章节：`### /03-code-gen-tdd 耗时报表` 下 `#### P3 java-review-agent`，**必须出现在返回文本末尾**。

| 步骤编号 | 步骤名称 |
|---------|---------|
| S1 | 规范加载（rules/java/_index.md + 按需 standards） |
| S2 | GitNexus 调用链分析（可选） |
| S3 | L0 BLOCKER 扫描 |
| S4 | L1/L2/L3 检查 |
| S5 | Review 报告落盘 |

---

## L0 — 强卡规则（发现即 BLOCK，必须修复后才能提交）

### 命名
- [ ] 类名未使用 UpperCamelCase（DO/BO/DTO/VO/AO 除外）
- [ ] 方法名、变量名未使用 lowerCamelCase
- [ ] 常量未使用 UPPER_SNAKE_CASE
- [ ] POJO 类布尔字段含 `is` 前缀（序列化框架会误解析）
- [ ] 使用拼音与英文混用，或直接使用中文命名

### 并发 / 线程
- [ ] 手动 `new Thread()` 未使用线程池
- [ ] 使用 `Executors.newXxx()` 创建线程池（队列/线程数无界）
- [ ] `@Async` 未指定线程池名称
- [ ] `SimpleDateFormat` 定义为 static（线程不安全）
- [ ] 计数操作使用 `count++` 而非 `AtomicInteger`

### SQL / DB
- [ ] `SELECT *` 查询
- [ ] JOIN 超过 3 张表
- [ ] MyBatis 使用 `${}` 拼接 SQL（SQL 注入风险）
- [ ] 禁止使用外键或级联（应用层处理）
- [ ] 使用 `float`/`double` 存储金额（应用 `decimal`）

### 安全
- [ ] 硬编码密钥 / 密码 / AK/SK / Token
- [ ] 用户输入未做有效性校验
- [ ] SQL 参数使用字符串拼接而非参数绑定

### 代码结构
- [ ] 单方法超过 200 行
- [ ] for 循环嵌套超过 3 层
- [ ] `if-else` 嵌套超过 3 层
- [ ] `catch` 块为空（吞异常）
- [ ] `finally` 块中有 `return` 语句

### Spring Boot 分层
- [ ] Controller 层包含业务逻辑
- [ ] `@Transactional` 加在 Controller 或 DAO 层
- [ ] `@Transactional` 用于非 `public` 方法（Spring AOP 代理不生效）
- [ ] 事务内包含 RPC/HTTP 远程调用（长事务占连接池）

### Redis
- [ ] Key 未设置 TTL（禁止永不过期 Key）
- [ ] 先删缓存再更新 DB（应先更 DB 再删缓存）
- [ ] 手写 `SET NX EX` 实现分布式锁（应使用 Redisson RLock）
- [ ] 分布式锁未在 `finally` 中释放

### MQ
- [ ] 消费者逻辑无幂等保护
- [ ] 涉及 DB 写入 + 发消息，未使用事务消息或本地消息表
- [ ] 消费者有未捕获异常导致消费卡住

---

## L1 — 高风险（强烈建议修复）

> 默认策略：与 L0 同批暴露、同批评估、尽量同批修复。

### 业务逻辑
- [ ] 无事务注解的多步写操作（数据一致性风险）
- [ ] 外部接口调用无超时设置
- [ ] 缺少必要的参数校验（`@Valid` / 手动校验）
- [ ] RPC 接口未用 `Result<T>` 封装返回值

### 集合 / 对象
- [ ] 集合初始化未指定容量（HashMap 建议 = 元素数/0.75 + 1）
- [ ] `ArrayList.subList()` 强转为 `ArrayList`
- [ ] `Arrays.asList()` 返回结果调用了 `add/remove/clear`
- [ ] `foreach` 循环内执行 `remove/add`（应用 Iterator）
- [ ] 包装类对象用 `==` 比较（应用 `equals`）
- [ ] `equals` 调用方可能为 null（应用常量/非空对象.equals(变量)）

### 日志
- [ ] `debug/info` 级别用字符串拼接而非 `{}` 占位符
- [ ] 异常日志未包含现场信息和堆栈 `logger.error("msg={}", param, e)`
- [ ] 使用 `e.printStackTrace()`（应用 logger）

### ORM
- [ ] 更新记录未同步更新 `gmt_modified`
- [ ] 查询结果集用 `HashMap`/`Hashtable` 接收
- [ ] `@Transactional` 方法内有 `try-catch` 但未手动回滚

### ES
- [ ] 使用 `wildcard` 前缀模糊（`*keyword`）
- [ ] 不带过滤条件的 `match_all` 查询
- [ ] 分页未限制 `size`，或 `from > 1000` 未改用 `search_after`
- [ ] 循环单条写入而非批量 Bulk API

### ElasticJob
- [ ] Job 执行逻辑未保证幂等
- [ ] Job 内使用 `Thread.sleep()` 做节流
- [ ] Job 异常被静默吞掉（假成功）

---

## L2 — 代码质量（建议修复）

- [ ] 方法命名不符合 lowerCamelCase
- [ ] 类命名不符合 UpperCamelCase
- [ ] POJO 类属性设置了默认值（应由调用方决定）
- [ ] 构造方法含业务逻辑（应提取为 `init()` 方法）
- [ ] 调用已 `@Deprecated` 方法
- [ ] 序列化类新增字段时修改了 `serialVersionUID`（不兼容升级才需修改）
- [ ] 工具类有 `public` 构造方法
- [ ] `BigDecimal` 使用 `equals()` 比较（应用 `compareTo()`）
- [ ] 接口入参超过 2 个字段未封装为 DTO（禁止用 Map 传参）
- [ ] Dubbo 非幂等接口 `retries` 未设为 0
- [ ] Redis Key 格式不符合 `业务名:模块名:唯一标识`
- [ ] ES 字符串字段类型选错

---

## L3 — 可读性（可选建议）

- [ ] 方法职责不单一
- [ ] 魔法数字未提取为常量
- [ ] 注释与代码不一致
- [ ] 枚举字段无注释说明用途
- [ ] 复杂条件未赋值给有意义的布尔变量名
- [ ] 循环体内创建对象（应移至循环外）
- [ ] 使用 `keySet()` 遍历 Map（应用 `entrySet()`）
