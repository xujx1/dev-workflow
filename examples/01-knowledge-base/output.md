# Stage 01-knowledge-base — 产出说明

## 产出文件

### `KB_FRESHNESS.md` — 知识库保鲜标记

> 示例见：[KB_FRESHNESS.md](./KB_FRESHNESS.md)

记录三库（应用/业务/测试）的最后更新时间和保鲜状态，是后续 Stage 判断知识库是否需要刷新的依据。

### `app-knowledge-base/` — 应用知识库目录

Agent 在应用工程根目录生成，结构如下：

```
app-knowledge-base/
├── CONTEXT.md                   ← 轻量入口（Agent 首读）
├── 00_概览.md                   ← 知识库导航与概览
├── 01_业务与领域知识层.md       ← 业务/领域总览
├── 02_架构与设计层.md           ← 架构、模块、依赖、接口分层
├── 03_核心流程与逻辑层.md       ← 核心流程、MQ、定时任务
├── 04_工程与规范层.md           ← 工程规范、异常、配置
├── 05_演进与决策记录层.md       ← 演进记录、技术决策
├── api-index.md                 ← 接口聚合索引
├── db-schema.md                 ← 数据库结构扫描
├── component-index.md           ← 组件索引
├── KB_FRESHNESS.md              ← 保鲜标记（本文件）
├── api-docs/                    ← API 文档（按接口拆分）
├── biz-knowledge/               ← 业务知识库
│   └── modules/                 ← 按业务模块拆分
└── test-knowledge/              ← 测试知识库
    └── modules/                 ← 按测试模块拆分
```

## 三库作用说明

| 知识库 | 主要用途 |
|---|---|
| 应用知识库（app-knowledge-base） | Stage 2 技术方案生成的事实基准；Stage 3 测试规格的架构参考 |
| 业务知识库（biz-knowledge） | Stage 2 PRD 生成时的术语转换和业务背景补充 |
| 测试知识库（test-knowledge） | Stage 3 测试用例生成时的场景覆盖参考 |

## 本案例数值（your-app-name）

| 知识库 | 文件数 | 状态 |
|---|---|---|
| 应用知识库 | 32 个文件（含 56 个接口文档） | ✅ |
| 业务知识库 | 22 个模块文档 | ✅ |
| 测试知识库 | 8 个模块文档 | ✅ |

详细保鲜记录见 [KB_FRESHNESS.md](./KB_FRESHNESS.md)。
