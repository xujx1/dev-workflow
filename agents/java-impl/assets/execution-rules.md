# java-impl-agent 执行规则详情

> 本文件由 `java-impl-agent.md` 骨架按需 Read。


## OpenSpec 集成规则（P0）

### 前置检查

编码前必须检查 OpenSpec 状态：

```bash
# 方式1：检查目录是否存在
test -d "openspec/changes/{change_name}" && echo "OPENSPEC_EXISTS" || echo "NO_OPENSPEC"

# 方式2：通过 MCP CLI 检查（推荐）
openspec status --change "{change_name}" --json
```

### 任务驱动实现

**当 OpenSpec 存在时**：

1. **读取 tasks.md**（P0 优先级）
   ```bash
   cat openspec/changes/{change_name}/tasks.md
   ```

2. **获取丰富指令**（注入项目上下文）
   ```bash
   openspec instructions tasks --change "{change_name}" --json
   ```

3. **按任务顺序实现**：
   - 遵循 tasks.md 中的分组和顺序
   - 每完成一个任务，更新 checkbox `[ ]` → `[x]`
   - 参考 `specs/` 目录中的接口定义

4. **任务完成验证**：
   ```bash
   openspec status --change "{change_name}"
   ```

### 任务状态更新

**每完成一个任务后必须更新 tasks.md**：

```python
import re, pathlib

def update_task_status(change_name: str, task_id: str):
    """更新 tasks.md 中的任务状态"""
    f = f'openspec/changes/{change_name}/tasks.md'
    c = pathlib.Path(f).read_text(encoding='utf-8')
    # 将 - [ ] {task_id} 改为 - [x] {task_id}
    pattern = rf'(\- \[ \] {re.escape(task_id)})'
    c = re.sub(pattern, rf'- [x] {task_id}', c)
    pathlib.Path(f).write_text(c, encoding='utf-8')
```

### 输入优先级

| 场景 | 优先输入 | 说明 |
|------|---------|------|
| 有 OpenSpec tasks.md | tasks.md > specs/ > design.md > tech-design.md | OpenSpec 驱动 |
| 无 OpenSpec | tech-design.md（原有逻辑） | 技术方案驱动 |

## 实现前置检查

开始编码前确认：

- [ ] 读取相关业务模块文档，理解业务规则
- [ ] grep 搜索现有类似实现，避免重复造轮子
- [ ] 确认修改落在哪一层（interfaces / application / domain / infrastructure）
- [ ] 确认异常处理规范（`04_工程与规范层.md`）
- [ ] 若涉及 DB 改动，确认字段命名规范（表名单数、必备三字段、禁止保留字）
- [ ] 若涉及 Redis，确认 Key 格式（`业务名:模块名:唯一标识`，必须设 TTL）
- [ ] 若涉及 MQ，确认消费幂等方案

## DDD 分层约定

```
{service}-interfaces/       ← Controller、Dubbo/gRPC 实现
{service}-application/      ← Application Service、Handler、Unit
{service}-domain/           ← 领域对象、领域服务、领域事件
{service}-infrastructure/   ← Mapper、外部 Client、MQ Producer
```

**分层职责硬约束**：
```
Controller   → 参数校验、协议转换，禁止写业务逻辑
Service      → 业务逻辑编排，@Transactional 所在层
Manager      → 通用能力下沉（缓存、三方封装、多 DAO 组合）
DAO/Mapper   → 只做数据读写，禁止包含业务判断
```

## 通用强卡规则（编码时实时强制）

### 命名
- 类名 UpperCamelCase（DO/BO/DTO/VO/AO 除外）
- 方法/变量 lowerCamelCase，常量 UPPER_SNAKE_CASE
- POJO 类布尔字段不加 `is` 前缀

### 并发 / 线程
- 禁止手动 `new Thread()`，使用项目统一线程池管理器
- 禁止 `Executors.newXxx()`，使用 `ThreadPoolExecutor` 显式创建
- `@Async` 必须指定线程池名称

### SQL / ORM
- 禁止 `SELECT *`，必须指定字段
- 禁止 `${}` 拼接（使用 `#{}`）
- 更新操作必须同步更新 `gmt_modified`
- 禁止 JOIN 超过 3 张表

### Spring Boot 分层
- `@Transactional` 只加在 Service 层 public 方法
- 事务内禁止 RPC/HTTP 远程调用
- 接口统一返回 `Result<T>`，入参 >2 字段封装 DTO

### Redis
- 所有 Key 必须设置 TTL
- 分布式锁必须使用 Redisson RLock，`finally` 中释放

### MQ
- 消费者必须实现幂等（DB 状态判断 or Redis SET NX msgId）
- DB 写入 + 发消息必须使用事务消息或本地消息表

### 代码结构
- 单方法 ≤ 200 行，for 循环嵌套 ≤ 3 层，`catch` 块不能为空

## 产物约束（硬约束，不可绕过）

- **禁止**生成 `code-changes.md`、`change-plan.md`、`impl-summary.md` 等变更描述文件
- **必须**直接修改对应的 `.java` 源文件
- 实现完成后只产出：已修改的 `.java` 源文件 + 编译结果 + BLOCKER 扫描报告

## Review 回流约定

当 `task=fix-review-blockers` 时：
- 必须读取本轮 `blocker_report`
- **L0 问题必须全部修复**
- 同文件、低风险、低成本的 L1 问题默认同批修复
- 高风险 L1 可保留，但需在摘要中说明原因
- 本 Agent 不重新执行完整 Review，只做修复 + 编译 + BLOCKER 快速扫描

## 实现流程

1. **OpenSpec 检查**：检查 `openspec/changes/{change_name}/tasks.md` 是否存在
2. 若存在 OpenSpec → 读取 `tasks.md` 作为任务清单
3. 若不存在 → 读取 `tech-design.md`（原有逻辑）
4. 读 `_index.md` → 路由到相关 L1 文档
5. 读业务模块文档，理解业务规则和代码入口
6. grep 搜索相似实现（参考命名风格）
7. 编码，实时遵守强卡规则
8. **每完成一个任务 → 更新 tasks.md checkbox**
9. 首轮实现完成后交给 `java-review-agent`（不在首轮强制跑 `mvn compile`）
10. 回流修复时优先 L0，尽量同批吸收低风险 L1
11. Phase 3 聚合 Review 非 BLOCK 后，统一执行一次 `mvn compile` 收口

## 计时规范

遵循 `rules/common/timing-spec.md`。

| 步骤编号 | 步骤名称 |
|---------|---------|
| S1 | 上下文加载（_index.md 路由 + L1 文档） |
| S2 | 业务模块读取与相似实现搜索 |
| S3 | 编码实现 |
| S4 | BLOCKER 快速扫描（回流时）/ 编译收口（Phase 3 后） |

报表子章节：`### /03-code-gen-tdd 耗时报表` 下 `#### P2 java-impl-agent`，**必须出现在返回文本末尾**。

## 项目定制区（在项目副本中填写）

```
项目名称：{PROJECT_NAME}
Maven 模块：{MAVEN_MODULES}
规范文档路径：app-knowledge-base/04_工程与规范层.md
特有约束：
  - {例：禁止使用 @Scheduled，所有定时任务通过 XXXJob 统一管理}
  - {例：所有 Redis Key 前缀必须为 {app_name}:{service_name}:}
高频场景快捷路径：
  - 新增 MQ 消费者：参考 {existing_consumer_class}
  - 新增 HTTP 接口：参考 {existing_controller_class}
```
