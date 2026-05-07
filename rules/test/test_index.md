# 测试规范索引（按需加载）

> 与 `rules/java/_index.md` 相同的按需路由设计：agent 先读本文件，
> 根据任务类型决定加载哪些测试规范文件，避免一次性加载全量内容消耗 token。
>
> 旧版单文件测试总规约已拆分迁移到 `rules/test/`，本目录即完整规范来源。

---

## 规范文件目录

| 文件 | 涵盖内容 | 适用任务 |
|------|---------|---------|
| `01-test-first.md` | 测试先行原则、TDD 循环、组件测试入口约定 | 任何测试生成任务 |
| `02-test-environment.md` | 测试环境策略（mock-first）、JUnit4+Mockito 依赖配置 | 搭建测试环境 |
| `03-data-model.md` | mock-first 数据构造规范（Mockito） | 编写测试数据 |
| `04-spec-format.md` | test_spec 8 章节结构、12 类场景、`EX1/EX2...` 校验点编号 | 生成 test_spec、需求评审 |
| `05-code-gen-rules.md` | AI 生成测试代码约定、Mock 规则、断言规范、Java-only 约束 | 生成测试代码、代码 Review |
| `06-test-templates.md` | mock-first 测试模板、Prompt 模板、标准代码骨架 | 需要代码示例模板、搭建测试骨架 |
| `07-coverage-and-cicd.md` | 覆盖率铁律、排除规则、CI/CD 与门禁 | 覆盖率治理、测试门禁、流水线集成 |
| `08-dubbo-testing.md` | Dubbo 测试环境、XML Bean、`@DubboReference` 约束 | Dubbo 工程测试代码生成 |
| `09-data-factory.md` | mock-first 数据构造说明（DataFactory 已废弃） | 了解数据构造规范 |
| `10-validation-checklists.md` | 生成前后检查清单、Mock 边界自查 | 生成测试代码、代码 Review、自检 |
| `11-appendix.md` | 测试依赖、`application-test.yml`、参考文档 | 补齐依赖与配置样例 |

---

## 任务类型 → 推荐加载文件

| 任务类型 | 必读文件 | 按需文件 |
|---------|---------|---------|
| 生成 test_spec 文档 | `01-test-first.md` + `04-spec-format.md` | `03-data-model.md`、`07-coverage-and-cicd.md`、`11-appendix.md` |
| 生成测试代码 | `01-test-first.md` + `05-code-gen-rules.md` + `10-validation-checklists.md` | `02-test-environment.md`、`06-test-templates.md`、`07-coverage-and-cicd.md`、`08-dubbo-testing.md`、`11-appendix.md` |
| 测试代码 Review | `01-test-first.md` + `05-code-gen-rules.md` + `10-validation-checklists.md` | `07-coverage-and-cicd.md`、`08-dubbo-testing.md` |
| 覆盖率治理 / CI 门禁 | `07-coverage-and-cicd.md` | `10-validation-checklists.md` |
| 全量规范参考 | `01-test-first.md` ~ `11-appendix.md` | — |

---

## 加载规则（agent 使用说明）

1. **默认**：每次测试相关任务先读本 `test_index.md`，查表只 Read 相关文件
2. **生成测试代码时**：至少读取 `01-test-first.md`、`05-code-gen-rules.md`、`10-validation-checklists.md`
3. **按场景补读**：Dubbo 工程读 `08-dubbo-testing.md`；需要模板示例读 `06-test-templates.md`；覆盖率/CI 读 `07-coverage-and-cicd.md`
4. **同一会话内已读文件不重复读取**

---

## 旧版章节映射

| 旧版章节 | 新位置 |
|---------|--------|
| §1 测试先行原则 | `01-test-first.md` |
| §2 高保真测试环境 | `02-test-environment.md` |
| §3 数据三层结构 | `03-data-model.md` |
| §4 test_spec 格式 | `04-spec-format.md` |
| §5 AI 测试代码生成规则 | `05-code-gen-rules.md` |
| §6 测试代码生成模板 | `06-test-templates.md` |
| §7 覆盖率要求 | `07-coverage-and-cicd.md` |
| §8 Apache Dubbo 测试环境约束 | `08-dubbo-testing.md` |
| §9 CI/CD 集成要求 | `07-coverage-and-cicd.md` |
| §10 测试数据工厂模式 | `09-data-factory.md` |
| §11 AI 测试生成检查清单 | `10-validation-checklists.md` |
| §12 附录 | `11-appendix.md` |

---

## 飞书规范原文

https://your-domain.feishu.cn/wiki/CYKww0XMyiNqvUkumwoclvPtn3f（第19章，测试规范）
