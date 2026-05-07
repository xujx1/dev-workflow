# Stage 01-knowledge-base — 输入示例

## 用户输入

```
/01-knowledge-base
```

## 说明

无需额外参数，Agent 自动完成：
- 扫描应用代码，生成应用知识库（`app-knowledge-base/`）
- 扫描业务文档，生成业务知识库（`biz-knowledge/`）
- 生成测试知识库（`test-knowledge/`），包含边界测试场景
- 生成 `KB_FRESHNESS.md` 知识库保鲜度记录
