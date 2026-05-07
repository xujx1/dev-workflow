# Rules — 规范标准

本目录定义 dev-workflow 项目的规范标准，参照 ECC (everything-claude-code) 结构组织。

## 目录结构

```
rules/
├── common/                  # 语言无关的通用原则（始终适用）
│   ├── agents.md            # Agent 编排规则：何时委托、并行执行
│   ├── development-workflow.md  # 开发工作流：规划→TDD→Review→提交
│   ├── git-workflow.md      # Git 工作流：提交格式、PR 规范
│   ├── hooks.md             # Hooks 使用规范：TodoWrite 最佳实践
│   ├── security.md          # 安全规范：密钥管理、提交前检查
│   └── testing.md           # 测试规范：80% 覆盖率、TDD 流程
│
└── java/                    # Java/Spring Boot 特定规范
    ├── architecture.md      # DDD 分层架构、事务规范、接口设计
    └── code-quality.md      # 代码质量：B1-B10 BLOCKER、L0/L1 Review 规则
```

## 规则优先级

当 `java/` 规则与 `common/` 规则冲突时，**Java 特定规则优先**。

- `common/` 定义适用于所有项目的通用原则
- `java/` 扩展通用规则，覆盖 Java 习惯不同之处

## 使用说明

- **Rules** 定义"做什么"（标准、约定、检查清单）
- **Skills**（`skills/` 目录）定义"怎么做"（深度参考材料）
- **Agents**（`agents/` 目录）定义"谁来做"（执行工具包）

## 规范权威来源

| 优先级 | 来源 |
|-------|------|
| P0 | 飞书 Java 开发规范（18章）— 可访问时优先 |
| P1 | `app-knowledge-base/04_工程与规范层.md` — 项目本地快照 |
| P2 | 本目录规则文件 — 离线兜底 |
