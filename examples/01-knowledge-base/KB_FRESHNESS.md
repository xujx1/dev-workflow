# 知识库保鲜标记

- 最近更新时间：2026-04-15
- 更新方式：full
- 保鲜周期：1个月
- 建议复查日期：2026-05-15
- 更新来源：skills/01-knowledge-base

## 三库覆盖状态

| 知识库 | 文件数 | 最后更新 | 状态 |
|---|---|---|---|
| 应用知识库（app-knowledge-base） | 32 个文件 | 2026-04-15 | ✅ 新鲜 |
| 业务知识库（biz-knowledge） | 22 个模块 | 2026-04-15 | ✅ 新鲜 |
| 测试知识库（test-knowledge） | 8 个模块 | 2026-04-15 | ✅ 新鲜 |

## 知识库目录结构（生成后）

```
app-knowledge-base/
├── CONTEXT.md                           ← 轻量入口（Agent 首读）
├── 00_概览.md                           ← 知识库导航与概览
├── 01_业务与领域知识层.md               ← 业务/领域总览
├── 02_架构与设计层.md                   ← 架构、模块、依赖、接口分层
├── 03_核心流程与逻辑层.md               ← 核心流程、MQ、定时任务
├── 04_工程与规范层.md                   ← 工程规范、异常、配置等
├── 05_演进与决策记录层.md               ← 演进记录、技术决策
├── api-index.md                         ← 接口聚合索引
├── component-index.md                   ← 组件索引
├── db-schema.md                         ← 数据库结构扫描
├── KB_FRESHNESS.md                      ← 本文件
├── api-docs/                            ← API 文档（按接口拆分）
├── biz-knowledge/                       ← 业务知识库
│   ├── carrier-integrator知识库.md
│   └── modules/                         ← 22 个业务模块文档
└── test-knowledge/                      ← 测试知识库
    ├── 测试知识库导航.md
    └── modules/                         ← 8 个测试模块文档
```
