## Python FastAPI Code Review 检查清单

### L0 - 阻塞项
- [ ] 代码无法运行
- [ ] 存在安全漏洞（SQL 注入、XSS 等）
- [ ] 缺少类型注解
- [ ] 未验证输入参数

### L1 - 重要项
- [ ] 未使用 async/await（异步场景）
- [ ] 异常处理不完整
- [ ] 重复代码
- [ ] 模块职责不清晰

### L2 - 建议项
- [ ] 命名规范一致性
- [ ] 代码格式化（Black）
- [ ] 注释完整性
- [ ] 依赖版本管理（requirements.txt/Pipfile）