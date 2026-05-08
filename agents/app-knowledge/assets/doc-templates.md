### 第六步：生成分层架构文档

基于第二步的代码分析（+ 第三步数据库结构 + 第四步 APM 数据 + 第五步飞书内容，如有），生成六层文档。

**每份文档末尾必须附加「Agent 代码生成约束」章节**（01/02/03 层为必填）：

| 模版文件 | 对应产出文件 | 使用场景 |
|---------|-----------|---------|
| [01-biz-domain-template.md](01-biz-domain-template.md) | `01_业务与领域知识层.md` | 业务场景、核心实体、状态、术语表 |
| [02-arch-design-template.md](02-arch-design-template.md) | `02_架构与设计层.md` | 模块结构、对外接口、数据访问、外部依赖 |
| [03-core-flow-template.md](03-core-flow-template.md) | `03_核心流程与逻辑层.md` | 流程编排、MQ 消费者、定时任务、关键状态 |
| [04-engineering-spec-template.md](04-engineering-spec-template.md) | `04_工程与规范层.md` | 编码规范、异常体系、MQ 基类、配置开关 |
| [05-evolution-adr-template.md](05-evolution-adr-template.md) | `05_演进与决策记录层.md` | ADR、技术债务、安全风险、演进建议 |

```markdown
