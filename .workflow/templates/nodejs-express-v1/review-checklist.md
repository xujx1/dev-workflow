## Node.js Express Code Review 检查清单

### L0 - 阻塞项
- [ ] 代码无法运行
- [ ] 存在安全漏洞（SQL 注入、XSS、路径遍历等）
- [ ] 缺少错误处理
- [ ] 未验证输入参数

### L1 - 重要项
- [ ] 回调地狱（未使用 async/await）
- [ ] 未处理 Promise rejection
- [ ] 重复代码
- [ ] 模块职责不清晰

### L2 - 建议项
- [ ] 命名规范一致性
- [ ] 代码格式化（Prettier）
- [ ] 注释完整性
- [ ] 依赖版本管理