## Node.js Express 代码生成提示模板

### 目录结构约定
```
src/
├── router/        # 路由层
├── service/       # 业务逻辑层
├── model/         # 数据模型
├── controller/    # 控制器层
├── middleware/    # 中间件
├── config/        # 配置文件
└── utils/         # 工具函数
```

### 命名约定
- 文件/目录名：短横线分隔（kebab-case）
- 类名：大驼峰（PascalCase）
- 函数/变量名：小驼峰（camelCase）

### 代码风格
- 使用 ES6+ 语法
- 使用 async/await
- 错误处理使用 try-catch
- 使用 Joi 进行参数校验

### 生成要求
1. 按 router/controller/service/model 分层生成
2. 生成完整的 CRUD 操作
3. 添加适当的错误处理中间件
4. 使用 Express Router 组织路由