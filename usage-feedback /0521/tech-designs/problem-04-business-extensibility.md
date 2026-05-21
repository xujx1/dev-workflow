# 技术方案：多业务系统扩展性设计

## 背景

dev-workflow 当前设计主要针对单一业务系统（单应用 + 单域）优化。随着团队将其推广到多个业务系统，出现以下问题：

1. 不同业务系统有不同的技术栈（Java Spring Boot、Node.js、Python 等），但共用同一套代码生成模板，导致生成质量下降。
2. 各业务系统的规范（命名约定、目录结构、测试框架）差异大，Harness 无法感知。
3. 多系统并行迭代时，知识库和工程目录相互干扰。

## 目标

1. 设计"项目 profile"机制，允许每个业务系统声明自己的技术栈与规范。
2. 代码生成阶段按 profile 路由到对应的生成策略。
3. 多系统知识库隔离，避免跨系统污染。
4. Harness 安装后，支持多系统共存于同一 monorepo 或独立 repo。

---

## 方案设计

### 项目 Profile 机制

每个业务系统根目录下新增或扩展 `.mrd-to-code-config.json`，声明该系统的 profile：

```json
{
  "project": {
    "name": "order-service",
    "tech_stack": "java-spring-boot",
    "test_framework": "junit5+mockito",
    "package_manager": "maven",
    "directory_convention": "layered"
  },
  "knowledge_base": {
    "root": "knowledge-base/",
    "context_file": "knowledge-base/CONTEXT.md"
  },
  "code_gen": {
    "template_set": "java-spring-boot-v2",
    "mock_strategy": "mock-first"
  }
}
```

支持的 `tech_stack` 枚举值：

| tech_stack | 说明 |
| --- | --- |
| `java-spring-boot` | Java + Spring Boot + Maven/Gradle |
| `nodejs-express` | Node.js + Express + npm |
| `python-fastapi` | Python + FastAPI + pip |
| `kotlin-ktor` | Kotlin + Ktor + Gradle |

### 代码生成策略路由

代码生成阶段（Phase 3）读取 `.mrd-to-code-config.json` 中的 `tech_stack`，路由到对应的 template_set：

```
tech_stack → template_set → 生成策略
java-spring-boot → java-spring-boot-v2 → 按 Controller/Service/Repository 分层生成
nodejs-express → nodejs-express-v1 → 按 router/service/model 分层生成
python-fastapi → python-fastapi-v1 → 按 router/service/schema 分层生成
```

**Template Set 目录结构**（以 java-spring-boot-v2 为例）：

```
.workflow/templates/java-spring-boot-v2/
├── code-gen-prompt.md        # 代码生成主 Prompt 模板
├── test-gen-prompt.md        # 测试生成主 Prompt 模板
├── review-checklist.md       # Code Review 检查清单
└── artifact-contract.yml     # 产物契约（关键文件路径声明）
```

### 多系统知识库隔离

**Monorepo 场景**（多系统在同一 repo）：

```
repo-root/
├── order-service/
│   ├── .mrd-to-code-config.json
│   └── knowledge-base/
│       ├── CONTEXT.md
│       └── domain/
├── payment-service/
│   ├── .mrd-to-code-config.json
│   └── knowledge-base/
│       ├── CONTEXT.md
│       └── domain/
└── .workflow/               # 共享 Orchestrator 配置
```

**独立 Repo 场景**：每个系统有自己的完整 Harness 安装，知识库天然隔离。

### 规范继承层级

```
组织级规范（.workflow/org-standards/）
    ↓ 继承
项目集规范（repo-root/.workflow/standards/）
    ↓ 继承，允许覆盖
单系统规范（service-dir/.mrd-to-code-config.json）
```

低层级规范可覆盖高层级规范的特定字段，不声明则继承。

### 跨系统接口依赖声明

当业务系统 A 的技术方案依赖业务系统 B 的接口时，在 A 的技术方案中显式声明依赖：

```yaml
# A 的技术方案 dependencies 字段
dependencies:
  - service: "payment-service"
    interface: "PaymentGateway.charge"
    contract_ref: "payment-service/knowledge-base/domain/payment/api-contract.md"
    mock_strategy: "mock-first"
```

代码生成阶段检测到跨系统依赖后，自动读取 `contract_ref` 文件，生成对应 mock 接口。

---

## 文件变更清单

| 文件 | 变更说明 |
| --- | --- |
| `.mrd-to-code-config.json` | 新增 `project.tech_stack`、`project.test_framework`、`code_gen.template_set` 字段 |
| `.workflow/templates/{tech_stack}/` | 新增各技术栈模板目录 |
| `skills/mrd-to-code-v2/skills/03-code-gen-tdd/SKILL.md` | 代码生成前读取 tech_stack，路由到对应模板 |
| `skills/mrd-to-code-v2/SKILL.md` | 新增多系统支持说明 |

---

## 验收标准

1. 不同 `tech_stack` 的项目，代码生成时使用各自对应的 template_set，生成结构符合该技术栈约定。
2. Monorepo 场景下，各子系统的知识库互不干扰。
3. 跨系统接口依赖能被正确识别，生成对应 mock 接口代码。
4. 组织级 / 项目集级规范能被正确继承，子系统可局部覆盖。

---

## 风险与注意事项

1. **模板维护成本**：每增加一种 tech_stack 都需要维护对应的模板，建议初期只支持最常用的 2-3 种。
2. **跨系统依赖复杂度**：跨系统接口依赖的 mock 生成依赖 contract_ref 文件的质量，需要被依赖系统先维护好 api-contract.md。
3. **Monorepo 路径冲突**：共享的 `.workflow/` 目录与各子系统的 `.workflow/` 目录需要明确优先级约定，避免配置覆盖混乱。
