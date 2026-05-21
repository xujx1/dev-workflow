# Changelog

All notable changes to dev-workflow are documented here.

---

## [Unreleased]

---

## [3.3.0] - 2026-05-21

### Added
- 新增 `/dev-workflow:doctor` 诊断入口与 `.workflow/scripts/doctor*.js`，用于检查配置、执行状态、关键产物、插件版本、知识库新鲜度和飞书权限。
- 新增 Orchestrator 安全微操作白名单、审计日志、执行状态修复、产物校验和 reconcile 差异报告脚本，回应长流程恢复中的状态一致性问题。
- 新增 `.workflow/tests` 三层回归测试体系，覆盖 Skill 契约检查、异常流程模拟和发布前预检钩子。
- 新增组织级、项目集级、项目级配置模板和配置合并器，支持规则继承、锁定字段和来源追踪。
- 新增 Java Spring Boot、Node.js Express、Python FastAPI 模板集，扩展代码生成、测试生成和 Review 清单。
- 新增项目风格画像、业务画像、Review 画像和知识库保鲜配置，支持按业务系统加载更贴近项目的上下文。
- 新增模型路由解析与风险升级机制，支持按阶段选择 quick / deep / writing 模型类别。

### Changed
- 强化 `02-implementation-plan` 和 `03-code-gen-tdd` 的复杂度分级、风险升级、mock-first 例外协议、自动修复停止条件和 Phase 6 发布汇总。
- 扩展 OpenSpec 触发规则，从单一人日阈值升级为“规模 + 接口变更 + 跨系统依赖 + 业务域风险”的多维判断。
- 更新 Java 实现、Java Review、技术方案和测试生成 Agent，使其读取项目画像、技术栈配置和增量影响信息。
- 将 `liumingz` 的使用反馈与技术讨论材料归档到 `usage-feedback /0521`，作为本次反馈驱动升级的来源记录。
- Open-source preparation: removed internal company identifiers.
- Open-source preparation: replaced internal Feishu domain with placeholder.
- Updated `SKILL.md`: simplified knowledge base version check.
- Added docs: README, QUICK_START, ARCHITECTURE, FEISHU_SETUP, CONTRIBUTING.

### Thanks
- 感谢 @liumingz 提供《dev-workflow 使用分享.pdf》和 10 个关键演进问题，推动本版本聚焦 Harness 稳定性、可恢复性、可扩展性和可测试性。

### Verification
- `.workflow/tests` 已提供 L1 / L2 回归测试入口：`cd .workflow/tests && npm run test:all`。
- `acceptance-test.js` 覆盖模型路由验收场景。

---

## [2.0.0] - 2026-05-07

### Added
- Full TDD workflow: TestSpec → code → review → test code → test runner
- Five auto-correction mechanisms in `03-code-gen-tdd`
- Checkpoint resume via `execution-state.md`
- Token gate: auto-check context usage before each stage
- L0/L1/L2 knowledge base injection layering (prevents context overflow)
- `kb-update-agent`: incremental knowledge base update on archive
- `instinct-extract-agent`: extract patterns from archive for future improvement
- `coverage-report-agent`: JaCoCo line/branch/method coverage analysis
- OpenSpec integration (optional, for API spec management)
- Multi-domain support: one MRD → multiple apps via `app-router-agent`

### Changed
- Merged Stage 1 (PRD) and Stage 2 (tech-design) into single `02-implementation-plan` skill
- Knowledge base restructured to 5-layer format (00_概览 through 06_演进)
- Agent return format standardized to `{status, file, size, summary}` (≤150 chars)

---

## [1.0.0] - Initial Release

### Added
- Basic MRD → PRD → tech-design → code generation flow
- Application knowledge base generation (`app-knowledge`)
- Java/Spring Boot code generation (`java-impl-agent`)
- Code review against CLAUDE.md (`java-review-agent`)
- Test code generation (`testcode-gen-agent`)
- Test runner with JaCoCo coverage (`tdd-test-runner-agent`)
- Feishu document sync (`feishu-doc-sync-agent`)
- Archive report generation (`archive-report-agent`)
