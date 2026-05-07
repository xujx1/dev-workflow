# Java 规范 — 控制语句、注释、异常与日志

> 来源：[飞书 Java 开发规范](https://your-domain.feishu.cn/wiki/CYKww0XMyiNqvUkumwoclvPtn3f)，第6-9章
> 索引：[../\_index.md](../_index.md)

---

## 六、控制语句

**强制**

- `switch` 每个 `case` 必须有 `break/return` 或注释说明穿透意图，必须包含 `default`
- `if/else/for/while/do` 必须使用大括号，即使只有一行

**推荐**

- 减少 `else`，优先用提前 return 替代
- `if-else` 嵌套不超过 3 层，超过用策略模式/状态模式重构
- 复杂条件判断结果赋值给有意义的布尔变量名，提高可读性
- 循环体内避免创建对象、获取连接等操作，移至循环外

---

## 七、注释规范

**强制**

- 类、属性、方法注释用 Javadoc (`/** */`)，不用 `//`
- 抽象方法（含接口方法）必须用 Javadoc 说明功能、参数、返回值
- 枚举字段必须有注释说明用途
- 方法内单行注释在被注释语句上方另起一行用 `//`

**推荐**

- 优先用中文注释把问题说清楚，专有名词保留英文
- 代码修改时同步更新注释
- 注释掉的代码要说明原因；无用代码直接删除（版本管理保留历史）

---

## 八、异常处理

**强制**

- 可预检查的运行时异常用条件判断规避，不用 `try-catch` 捕获（如 NPE、IndexOutOfBounds）
- 禁止用异常做流程控制
- 捕获异常必须处理，禁止空 catch；不处理则往上抛
- `finally` 必须关闭资源（推荐 try-with-resources）；禁止在 `finally` 中 `return`
- 事务代码中 catch 异常后需要回滚时，必须手动回滚事务
- 禁止直接抛 `new RuntimeException()`/`Exception`/`Throwable`，用有业务含义的自定义异常

**推荐**

- 对外 HTTP/API 接口用错误码；应用内用异常；跨应用 RPC 用 `Result<T>` 封装
- 防止 NPE 的重点场景：自动拆箱、数据库查询结果、远程调用返回值、级联调用链
- 遵守 DRY 原则，公共校验逻辑抽取成方法，禁止复制粘贴

---

## 九、日志规范

**强制**

- 使用 SLF4J 门面，不直接用 Log4j/Logback API
- `debug/info` 级别输出必须用占位符 `{}` 或条件判断，禁止字符串拼接
- 异常日志必须包含现场信息和堆栈：`logger.error("msg={}", param, e)`
- 避免重复打印日志，log4j 配置中设置 `additivity=false`

**推荐**

- 生产禁止 debug 日志；谨慎输出 info；用户输入错误用 warn，系统错误用 error
- 记录日志前思考：这条日志有人看吗？能帮助排查问题吗？
