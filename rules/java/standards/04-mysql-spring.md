# Java 规范 — MySQL/ORM 与 Spring Boot 分层

> 来源：[飞书 Java 开发规范](https://your-domain.feishu.cn/wiki/CYKww0XMyiNqvUkumwoclvPtn3f)，第10章、第12章
> 索引：[../\_index.md](../_index.md)

---

## 十、MySQL / ORM

### 建表规范

**强制**

- 是否字段命名 `is_xxx`，类型 `unsigned tinyint`
- 表名、字段名全小写，禁止数字开头
- 表名用单数
- 禁用保留字（`desc`、`range`、`match` 等）
- 索引命名：唯一索引 `uk_字段名`，普通索引 `idx_字段名`
- 小数用 `decimal`，禁止 `float`/`double`
- 表必备三字段：`id`（unsigned bigint 主键）、`gmt_create`、`gmt_modified`

### 索引规范

**强制**

- 业务唯一字段必须建唯一索引
- 禁止超过 3 张表 JOIN；JOIN 字段数据类型必须一致且有索引
- 页面搜索禁止左模糊或全模糊，需走搜索引擎

**推荐**

- 组合索引区分度最高的列放最左边；等号条件列前置
- 利用覆盖索引避免回表
- 超大分页（offset 很大）用延迟关联优化
- SQL 性能目标：至少 range 级别，最优 consts

### SQL 规范

**强制**

- 统计行数用 `count(*)`
- `sum()` 结果可能为 NULL，使用时注意 NPE：`IF(ISNULL(SUM(g)), 0, SUM(g))`
- 用 `ISNULL()` 判断 NULL，禁止用 `= NULL`
- 分页查询 count 为 0 直接返回，不执行后续分页语句
- 禁止外键与级联，外键逻辑在应用层处理
- 禁止存储过程
- 数据订正操作先 `SELECT` 确认，再执行 `UPDATE/DELETE`

### ORM 规范

**强制**

- MyBatis 参数用 `#{}` 不用 `${}`（防 SQL 注入）
- 更新记录必须同时更新 `gmt_modified` 为当前时间
- 禁止用 `HashMap`/`Hashtable` 作查询结果集输出

**推荐**

- 不写大而全的更新接口，只更新有变更的字段
- `@Transactional` 不滥用，考虑缓存/消息等回滚方案

---

## 十二、Spring Boot 分层规范

### 分层职责

```
Controller   →  参数校验、协议转换、权限拦截，禁止写业务逻辑
Service      →  业务逻辑编排，事务边界所在层
Manager      →  通用能力下沉（缓存、三方封装、多 DAO 组合）
DAO / Mapper →  只做数据读写，禁止包含业务判断
```

**强制**

- Controller 只做参数校验和结果封装，不写业务逻辑
- `@Transactional` 只加在 Service 层，禁止加在 Controller 和 DAO
- Service 方法内如有 try-catch 且需要回滚，必须手动 `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()` 或重新抛出异常
- `@Transactional` 禁止用于非 public 方法（Spring AOP 代理不生效）
- 同类内部方法互调不经过 Spring 代理，事务/缓存注解不生效，需通过 `AopContext.currentProxy()` 或拆分类解决
- RPC/HTTP 远程调用禁止放在事务内（长事务占连接池，且远程调用无法回滚）
- 接口统一返回 `Result<T>` 封装，包含 `code`、`message`、`data` 三个字段
- 接口入参超过 2 个字段必须封装为 DTO，禁止用 `Map` 传参

### 统一响应体规范

```java
// 正例
public class Result<T> {
    private Integer code;    // 0 成功，非 0 失败
    private String message;
    private T data;
}

// 所有 Controller 方法返回 Result<T>，禁止直接返回 POJO 或 void
```
