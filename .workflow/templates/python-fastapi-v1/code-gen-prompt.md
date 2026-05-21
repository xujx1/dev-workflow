## Python FastAPI 代码生成提示模板

### 目录结构约定
```
app/
├── router/        # 路由层
├── service/       # 业务逻辑层
├── schema/        # Pydantic 模型
├── model/         # 数据库模型
├── crud/          # CRUD 操作
├── config/        # 配置文件
└── exceptions/    # 自定义异常
```

### 命名约定
- 文件/目录名：下划线分隔（snake_case）
- 类名：大驼峰（PascalCase）
- 函数/变量名：下划线分隔（snake_case）

### 代码风格
- 使用 Python 3.10+ 语法
- 使用 Pydantic 进行数据验证
- 使用 FastAPI 依赖注入
- 类型注解全覆盖

### 生成要求
1. 按 router/service/schema/crud 分层生成
2. 生成完整的 CRUD 操作
3. 添加适当的异常处理
4. 使用 FastAPI APIRouter 组织路由