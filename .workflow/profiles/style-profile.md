# Style Profile: {应用名称}

## 分层习惯

- Controller：只做参数校验 + 调用 AppService，禁止业务逻辑。
- AppService：编排，不含领域逻辑，负责事务边界。
- DomainService：核心业务逻辑，允许调用 Repository。
- Repository：只做数据访问，禁止业务逻辑。

## 命名习惯

- Request/Response：XxxRequest / XxxResponse（不用 DTO 后缀）。
- 领域对象：XxxBO（Business Object），转换类用 XxxConverter。
- 不使用 MapStruct，统一用手写 Converter 保持可读性。

## 日志习惯

- 入口日志：所有 AppService 入口必须打 info 日志，包含 bizId / orderNo。
- 敏感字段：手机号、身份证号禁止打日志，用 `****` 脱敏替代。
- 异常日志：业务异常打 warn，系统异常打 error，必须含堆栈。

## 异常习惯

- 业务异常：抛 BizException，包含 errorCode（枚举）+ message。
- 参数校验：在 Controller 或 AppService 入口用 Preconditions 检查，异常类型 BizException。
- 外部依赖异常：捕获并转换为 SystemException，禁止裸抛第三方异常。

## 测试习惯

- 命名：`testXxx_whenYyy_thenZzz`，清晰描述场景和预期。
- 组织：given-when-then 三段式，不省略 given。
- Mock：只 mock 外部依赖（Repository、RPC、消息），不 mock 领域逻辑。

## 注释习惯

- 普通代码不写解释性注释。
- 状态机、资金、库存、数据一致性逻辑必须说明业务原因。