# 05 演进与决策记录层

> 证据：静态扫描 TODO/FIXME、pom.xml 注释、代码逆向归纳；**未**做 git log 提交史分析。

## 架构决策记录（ADR）— 从代码反推的既定事实

| ID | 决策 | 状态 | 证据 |
|----|------|------|------|
| ADR-001 | {如"流程编排采用注解声明 Unit 链 + 抽象基类"} | 已落地 | {如 @FlowControl、AbstractFlowHandler 广泛使用} |
| ADR-002 | {如"Dubbo 暴露不使用 @DubboService，用 Spring @Service"} | 已落地 | {如 *DubboServiceImpl 与 CLAUDE.md} |
| ADR-003 | {如"MQ 统一基于 Fusion DMQ BaseDmqProcessor"} | 已落地 | {如 BaseMqConsumer 等} |
| ADR-004 | {决策4} | {状态} | {证据} |

> 正式 ADR 文档（背景/备选方案/后果）**未在仓库内发现**；上表为逆向归纳，**非**委员会评审记录。

## 技术债务与代码内 TODO（抽样）

静态 grep `TODO|FIXME` 在 `main` 源码中命中（示例，**非全量**）：

- `{ClassName1}.java` — {待办描述}
- `{ClassName2}.java` — {待办描述}

**完整清单**：`rg "TODO|FIXME" {模块名}-*/src/main/java`

## 依赖与模块演进

- {如"根 pom.xml 明示 xx 依赖「后续需要排掉」——依赖瘦身待跟踪"}
- {如"某模块名存在历史拼写错误，是否历史包袱 [待确认]"}

## 安全与合规风险（静态）

- {如"generatorConfig.xml 含 JDBC 口令明文 — 敏感信息入库风险，建议迁移至密钥管理"}
- {如"公网回调 Controller 多 — 依赖签名校验与网关 ACL，需安全评审 [待确认]"}

## 建议的后续演进（待产品/架构确认）

1. {如"补齐 APM 视图，按接口维度建立 SLO"}
2. {如"对核心表做受控 SHOW CREATE TABLE 归档，与 DO 对齐"}
3. {如"将 MQ Topic/Consumer 关系生成一张表"}

---

## Agent 代码生成约束

- {约束1：如"改动前检索同模块是否已有 TODO 指明的坑，避免重复实现"}
- {约束2：如"不新增已标记「将废弃」依赖上的功能"}
- {约束3：如"安全相关改动须走安全评审，不在知识库臆测放行条件"}
