# 知识库模版说明

本目录存放应用知识库的标准模版，供梳理知识库时参照。

## 使用说明

| 模版文件 | 对应产出文件 | 使用场景 |
|---------|-----------|---------|
| [app-kb-template.md](app-kb-template.md) | `00_概览.md` | 服务概览，含高频接口、关键规则、外部依赖 |
| [01-biz-domain-template.md](01-biz-domain-template.md) | `01_业务与领域知识层.md` | 业务场景、核心实体、状态、术语表 |
| [02-arch-design-template.md](02-arch-design-template.md) | `02_架构与设计层.md` | 模块结构、对外接口、数据访问、外部依赖 |
| [03-core-flow-template.md](03-core-flow-template.md) | `03_核心流程与逻辑层.md` | 流程编排、MQ 消费者、定时任务、关键状态 |
| [04-engineering-spec-template.md](04-engineering-spec-template.md) | `04_工程与规范层.md` | 编码规范、异常体系、MQ 基类、配置开关 |
| [05-evolution-adr-template.md](05-evolution-adr-template.md) | `05_演进与决策记录层.md` | ADR、技术债务、安全风险、演进建议 |

## 模版设计原则

1. **轻量优先**：模版只保留 Agent 生成代码必须知道的内容；详细说明放子文档，通过索引引用
2. **规则直写**：业务规则直接写在模版里，不引用外部文档；Agent 加载时能立刻获取
3. **可验证字段**：每个字段都有明确的填写范例，禁止"待补充"占位
4. **大小控制**：每个模版填完后目标 ≤300 行（`00_概览.md` ≤200 行）
