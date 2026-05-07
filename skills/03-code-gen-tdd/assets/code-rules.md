# 代码规约检查规则

> 本文件定义 `skills/03-code-gen-tdd` 在代码生成阶段（Stage 3）Apply 后必须执行的规约检查规则。
> 规范权威来源：[飞书 Java 开发规范](https://your-domain.feishu.cn/wiki/CYKww0XMyiNqvUkumwoclvPtn3f)（18章）

---

## 规约检查执行方式

Stage 3 Apply 完成后，**按以下顺序执行两轮检查**：

### 第一轮：快速 BLOCKER 扫描（代码提交前，同步执行）

对 git diff 涉及的所有 `.java` 文件，检查以下 BLOCKER 项，**发现任意一项立即修复，再继续**：

| # | 规则 | 检查方式 |
|---|------|---------|
| B1 | `SELECT *` 查询 | grep `SELECT \*` in `*.xml` 和 `@Select` 注解 |
| B2 | MyBatis `${}` 拼接 SQL | grep `\$\{` in `*.xml` 和 Mapper 注解 |
| B3 | `Executors.newXxx()` 创建线程池 | grep `Executors\.new` in `*.java` |
| B4 | 手动 `new Thread()` | grep `new Thread\(` in `*.java` |
| B5 | `@Async` 未指定线程池 | grep `@Async` 无括号参数 |
| B6 | `@Transactional` 在非 public 方法 | 检查 Transactional 注解的方法访问修饰符 |
| B7 | 事务内 RPC 调用（Dubbo/Feign/HttpClient） | 检查 `@Transactional` 方法体内是否有 RPC/HTTP 调用 |
| B8 | 硬编码密码/AK/SK/Token | grep `password\s*=\s*"[^"]+"` 等模式 |
| B9 | 空 catch 块 | grep `catch.*\{\s*\}` |
| B10 | Redis Key 无 TTL 设置 | 检查 `redisTemplate.opsForValue().set()` 是否传 TTL |

**修复所有 BLOCKER 后才能执行 `git commit`。**

---

### 第二轮：全量 java-review-agent Review（commit 后，异步子代理执行）

git commit 完成后，以 `Task` 工具 spawn `java-review-agent` 子代理执行全量 Review：

```
请读取 {java_review_agent_path}（从 config.agents.agents_dir 回退链推导）并严格按其指令执行。

输入参数：
- review_target: git diff HEAD~1 HEAD（仅当前 commit 的变更）
- feature_dir: {feature_dir}
- change_name: {change_name}
- kb_local_path: {kb_local_path}

产出：
- 写入 {feature_dir}/code-review.md
- 返回 review_result（BLOCK / WARN / PASS）

执行完成后直接返回 review_result，不需要等待用户确认。
```

**根据 review_result 决定后续流程**：

| review_result | 后续动作 |
|--------------|---------|
| BLOCK（有 L0 问题） | 修复所有 L0 问题 → `git commit --amend`（或新 commit 追加修复）→ 重新触发 Review 子代理，直到 PASS 或 WARN |
| WARN（有 L1 问题） | 记录 Review 报告路径到 orchestrator，继续执行 test-spec 子代理（L1 问题由开发人员在 PR 阶段处理） |
| PASS（无问题） | 继续执行 test-spec 子代理 |

---

## 改动场景 → 检查重点速查

| 改动场景 | 必检规则（对应飞书规范章节） |
|---------|--------------------------|
| 新建/修改类、方法、变量命名 | 第一章命名规范（L0：布尔字段含 is、拼音混用） |
| OOP 方法覆写 | 第三章 OOP 规约（L0：未加 @Override、equals 未重写 hashCode） |
| 集合初始化/使用 | 第四章集合处理（L1：未指定初始容量、foreach 内 remove） |
| 并发 / 线程池 | 第五章并发处理（L0：Executors、new Thread） |
| 控制流 / if-else | 第六章控制语句（L0：嵌套超 3 层、switch 无 default） |
| 日志输出 | 第九章日志规范（L1：字符串拼接替代 {}、空堆栈） |
| MyBatis / SQL | 第十章 MySQL/ORM（L0：SELECT*、${}、无 gmt_modified 更新） |
| Spring Boot 分层 | 第十二章分层规范（L0：Controller 含业务逻辑、Transactional 位置错） |
| Redis 操作 | 第十三章 Redis 规范（L0：Key 无 TTL、手写 SET NX EX 分布式锁） |
| MQ 生产/消费 | 第十四章 MQ 规范（L0：消费无幂等、DB 写 + 消息无事务保护） |
| ES 操作 | 第十六章 ES 规范（L1：wildcard 前缀模糊、match_all 无过滤） |
| Dubbo/Feign | 第十八章服务治理（L0：事务内 RPC、无超时设置） |

---

## BLOCKER 定义（与 java-review-agent L0 对齐）

| 级别 | 定义 | 处理 |
|-----|------|------|
| BLOCKER（= L0） | 安全漏洞、线程安全、数据一致性、Spring AOP 失效 | **必须修复后才能 commit** |
| WARNING（= L1） | 业务逻辑风险、性能问题 | 记录，不阻塞 commit |
| INFO（= L2/L3） | 代码质量、可读性 | 记录，可选处理 |

---

## java-review-agent 路径推导规则

`java_review_agent_path` 从 `config` 参数推导：

1. 若 `config.agents.agents_dir` 已配置 → `{config.agents.agents_dir}/java-review/java-review-agent.md`
2. 降级：`{project_root}/.claude/agents/java-review/java-review-agent.md`
3. 降级：`$HOME/.claude/plugins/dev-workflow/agents/java-review/java-review-agent.md`（本 skill 仓库）

> **skill_root**：固定为 `$HOME/.claude/plugins/dev-workflow`。
> **project_root 定义**：当前业务工程根目录，即执行主流程时的 `$PWD`。
