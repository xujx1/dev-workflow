## Python FastAPI 测试代码生成提示模板

### 测试框架
- pytest
- pytest-asyncio
- httpx

### 测试目录结构
```
tests/
├── router/        # 路由测试
├── service/       # 服务层测试
└── crud/          # CRUD 测试
```

### 测试命名约定
- 测试文件：test_{filename}.py
- 测试方法：def test_{description}()

### Mock 策略
- 使用 unittest.mock.patch
- 使用 pytest-mock
- 使用 fixtures 管理测试数据

### 测试覆盖要求
- 覆盖率目标：≥80%
- 覆盖正常路径和异常路径
- 使用 parametrize 覆盖多组输入