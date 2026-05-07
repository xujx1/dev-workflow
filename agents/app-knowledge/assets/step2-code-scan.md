## ⚠️ 扫描硬约束（P0，任何步骤不可违反）

> **禁止将文件完整内容读入上下文。** 所有扫描命令只允许输出：文件名列表、行数统计、关键词匹配的单行摘要（最多 3 行/文件）。
>
> - ❌ 禁止 `cat`、`Read`（工具）读取源码文件完整内容
> - ❌ 禁止 `grep -A N`（N>3）展开代码块
> - ❌ 禁止一次 `find` 后逐个 Read 每个 .java 文件
> - ✅ 允许 `find ... | wc -l`（计数）
> - ✅ 允许 `grep -l`（仅输出文件名）
> - ✅ 允许 `grep -m 1`（每文件只取首个匹配行）
>
> **扫描结果只写入内存摘要（见 2步输出格式），不粘贴原始命令输出到上下文。**

---

#### 2.1 模块结构识别

扫描工程目录，识别 DDD 分层模块：

```bash
# 识别模块名与分层（只输出目录名，不展开内容）
find {工程根} -maxdepth 1 -type d
# 典型结构：-api / -application / -domain / -infrastructure / -interfaces
```

#### 2.2 服务入口统计

```bash
# Dubbo 服务实现类
find . -name "*DubboServiceImpl*.java" -not -path "*/test/*" | wc -l

# HTTP Controller
find . -name "*Controller*.java" -not -path "*/test/*" | wc -l

# MQ 消费者（含各类 MQ 框架）
find . -name "*Consumer*.java" -not -path "*/test/*" | wc -l

# 业务流程编排器
grep -rl "@FlowControl\|AbstractFlowHandler\|Handler" --include="*.java" | grep -v test | wc -l
```

#### 2.3 领域模型提取

```bash
# 状态机枚举（核心业务状态）
find . -name "*StatusEnum*.java" -o -name "*StateEnum*.java" \
  -o -name "*Status*.java" -path "*/enums/*" | grep -v test

# 核心领域实体
find . -path "*/domain/*/model/*.java" -o -path "*/domain/*/entity/*.java" | grep -v test

# 领域事件
find . -name "*Event*.java" -o -name "*DomainEvent*.java" | grep -v test
```

#### 2.4 业务流程链识别

```bash
# @FlowControl 编排链（只输出文件名列表，禁止展开内容）
grep -rl "@FlowControl" --include="*.java" | grep -v test

# 每个 Handler 的 Unit 链（只取 @FlowControl 那一行 + 后续3行，禁止 grep -A N>3）
grep -A 3 "@FlowControl" {Handler文件} | grep "Unit.class"

# MQ 消费者按业务域分类（只输出文件名）
find . -path "*/mq/consumer/*.java" -not -path "*/test/*" | sort
```

#### 2.5 外部依赖识别

```bash
# Feign Client（外部服务调用）
grep -rl "@FeignClient" --include="*.java" | grep -v test

# Mapper / Repository（数据访问）
find . -name "*Mapper*.java" -o -name "*Repository*.java" | grep -v test

# 定时任务
grep -rl "@Scheduled\|DJobComponent\|SimpleJob" --include="*.java" | grep -v test
```

#### 2.6 代码规范提取

```bash
# 基础类（MQ基类、Handler基类、异常体系）
find . -name "Base*.java" -o -name "Abstract*.java" | grep -v test

# 异常类
find . -name "*Exception*.java" | grep -v test

# 配置类
find . -name "*.properties" -o -name "*.yml" | grep -v test | head -5
```

**2步输出（写入内存，不落盘）**：

```
核心发现：
- Dubbo服务：N 个
- HTTP Controller：N 个
- MQ消费者：N 个（按业务域：轨迹M1个、运单M2个、...）
- Handler编排器：N 个（@FlowControl 链）
- Mapper：N 个
- 状态枚举：N 个
- 外部 Feign 依赖：N 个服务
- 定时任务：N 个
```

**2步落盘（component-index.md，硬约束）**：

扫描完成后，**必须**将以上统计结果落盘为 `{kb_output_path}/component-index.md`，格式如下：

```markdown
# 组件索引 — {工程名}

> 扫描时间：{YYYY-MM-DD} | 工程路径：{project_path}

## 服务入口统计

| 组件类型 | 数量 | 说明 |
|---------|------|------|
| Dubbo 服务实现（*DubboServiceImpl） | N | RPC 服务暴露层 |
| HTTP Controller | N | REST 接口层 |
| MQ 消费者 | N | 消息消费入口 |
| Handler 编排器（@FlowControl） | N | 业务流程编排 |
| Mapper / Repository | N | 数据访问层 |
| Feign Client | N | 外部服务调用 |
| 定时任务 | N | @Scheduled / DJobComponent |

## MQ 消费者按业务域分布

| 业务域 | 数量 |
|--------|------|
| {域名} | N |

## 核心 Handler 编排器列表（前20个，完整见 03_核心流程与逻辑层.md）

| Handler | 所属模块 |
|---------|---------|
| {HandlerName} | {模块} |

---

> 完整接口清单见 `api-index.md`；数据库表结构见 `db-schema.md`
```

> ⚠️ **落盘硬约束**：第二步扫描完成后必须写入 `component-index.md`，**禁止只把统计数字写入其他文档内嵌而不生成独立文件**。总行数 ≤ 150 行。

---
