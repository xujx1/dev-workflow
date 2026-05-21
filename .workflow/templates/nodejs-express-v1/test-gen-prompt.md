## Node.js Express 测试代码生成提示模板

### 测试框架
- Jest
- Supertest
- Mockito.js

### 测试目录结构
```
test/
├── router/        # 路由测试
├── service/       # 服务层测试
└── controller/    # 控制器测试
```

### 测试命名约定
- 测试文件：{filename}.test.js
- 测试方法：test('{description}', () => {})

### Mock 策略
- 使用 jest.mock() 模拟模块
- 使用 jest.fn() 创建 mock 函数
- 使用 mockResolvedValue/mockRejectedValue

### 测试覆盖要求
- 覆盖率目标：≥80%
- 覆盖正常路径和异常路径
- 使用 describe/it 组织测试用例