## Java Spring Boot 测试代码生成提示模板

### 测试框架
- JUnit 5
- Mockito
- Spring Boot Test

### 测试目录结构
```
src/test/java/{package}/
├── controller/    # Controller 层测试
├── service/       # Service 层测试
└── repository/    # Repository 层测试
```

### 测试命名约定
- 测试类名：{ClassName}Test
- 测试方法名：test{MethodName}_{Scenario}_{ExpectedResult}

### Mock 策略
- 使用 @Mock 注解模拟依赖
- 使用 @InjectMocks 注入被测对象
- 使用 Mockito.when() 定义 mock 行为

### 测试覆盖要求
- 覆盖率目标：≥80%
- 覆盖正常路径和异常路径
- 使用 ParameterizedTest 覆盖多组输入