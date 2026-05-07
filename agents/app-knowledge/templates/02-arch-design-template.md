# 02 架构与设计层

> 证据：pom.xml 模块列表、源码目录结构、静态 grep；**无**运行时拓扑。

## DDD 与 Maven 模块

| 模块 | 包根 | 设计要点 |
|------|------|----------|
| `{模块名}-api` | `{包路径}.api` | Dubbo 接口、请求/响应 DTO、FeignClient |
| `{模块名}-application` | `{包路径}.application` | Dubbo 实现、应用服务、handler、mq/consumer、job |
| `{模块名}-domain` | `{包路径}.domain` | 领域服务、仓储接口（*Repository）、策略与工厂 |
| `{模块名}-infrastructure` | `{包路径}.infrastructure` | MyBatis DO/Mapper、三方 SDK、gateway 实现、配置 |
| `{模块名}-interfaces` | `{包路径}.interfaces` | Spring MVC Controller、全局异常处理 |

父工程版本：**{X.Y.Z-RELEASE}**

## 对外接口

### Dubbo

- **接口文件数**：{N} 个（`api/dubbo` 包）
- **实现类数**：{N} 个（`*DubboServiceImpl`）
- **注册风格**：{如"Spring @Service 实现接口，禁止 @DubboService"}

### HTTP

- **Controller 类数**：{N} 个（`interfaces/facade`）
- **典型路径**：如 `@RequestMapping("/{模块}/{业务}")`

## 数据访问

| 类型 | 规模 | 位置 |
|------|------|------|
| MyBatis `*Mapper.java` | {N} 个 | `infrastructure/.../db` |
| DO 类 | {N} 个 | `.../db/dataobject` |
| 领域 `*Repository.java` | {N} 个 | `domain/**/repository` |

MyBatis Generator：`generatorConfig.xml` {存在/不存在}；启用表 {N} 张（详见 `db-schema.md`）。

## 外部依赖

### OpenFeign（`@FeignClient`）

共 {N} 个接口类，位于 `api/.../client`：`{ClientA}`、`{ClientB}`…

### 消息

使用 {消息框架，如 `com.poizon.fusion.dmq`}（`{BaseMsgProcessor}`、`{MsgMessage}`）作为消费骨架。

## 横切能力

- **限流**：{如 Sentinel `@SentinelResource`，或无}
- **缓存**：{如 JetCache / Caffeine / 本地刷新}
- **分布式锁**：{如 `DistributedLockManager`，或无}

---

## Agent 代码生成约束

- {约束1：如"新增 Dubbo 实现类 → 必须放在 application/dubbo/impl，使用 @Service"}
- {约束2：如"新增 Mapper/SQL → 禁止 selectByExample、禁止 SELECT *"}
- {约束3：如"新增仓储 → domain 定义接口，infrastructure 实现"}
