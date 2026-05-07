# Changelog

All notable changes to dev-workflow are documented here.

---

## [Unreleased]

### Changed
- Open-source preparation: removed internal company identifiers
- Open-source preparation: replaced internal Feishu domain with placeholder
- Updated SKILL.md: simplified knowledge base version check
- Added docs: README, QUICK_START, ARCHITECTURE, FEISHU_SETUP, CONTRIBUTING

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
