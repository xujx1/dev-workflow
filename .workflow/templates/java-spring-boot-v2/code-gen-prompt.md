## Java Spring Boot 代码生成提示模板

### 目录结构约定
```
src/main/java/{package}/
├── controller/    # REST API 控制层
├── service/       # 业务逻辑层
├── repository/    # 数据访问层
├── entity/        # 数据库实体
├── dto/           # 数据传输对象
├── config/        # 配置类
└── exception/     # 异常处理
```

### 命名约定
- 类名：大驼峰（PascalCase）
- 方法名：小驼峰（camelCase）
- 变量名：小驼峰（camelCase）
- 包名：全小写，用点分隔

### 代码风格
- 使用 Lombok 简化代码
- 遵循 Spring Boot 最佳实践
- 使用 Constructor Injection
- 异常处理使用 @ControllerAdvice

### 生成要求
1. 按 Controller/Service/Repository 分层生成
2. 生成完整的 CRUD 操作
3. 添加适当的日志记录
4. 实现业务异常处理