# dev-workflow

> 一套跑在 Claude Code 里的 Java TDD 全流程自动化插件。从 MRD 到可跑通单测的代码，全程 AI 驱动，人在关键节点确认。

## 版本升级通知

`v3.3.0` 已发布。本次升级来自 `usage-feedback /0521/dev-workflow 使用分享.pdf` 中 @liumingz 对 dev-workflow 的系统性反馈，重点增强 Harness 的稳定性、可恢复性、业务扩展能力和自身回归测试。

主要变化：

- 新增 `/dev-workflow:doctor` 诊断入口，提前检查配置、执行状态、关键产物、插件版本、知识库新鲜度和飞书权限。
- 引入 Orchestrator 安全微操作白名单、审计日志和 reconcile 差异报告，解决长流程恢复时 state / Beads / 文件产物不一致的问题。
- 增加需求复杂度分级、风险升级、OpenSpec 多维触发、mock-first 例外协议和自动修复停止条件。
- 支持组织级、项目集级、项目级配置继承，以及项目风格画像、业务画像和模型路由。
- 新增 `.workflow/tests` 回归测试体系，用 L1 契约检查和 L2 流程模拟保护 Harness 自身升级。

感谢 @liumingz 提供真实使用分享和 10 个关键演进问题。本次发布公告见 [RELEASE_2026-05-21.md](./docs/RELEASE_2026-05-21.md)，完整版本记录见 [CHANGELOG.md](./docs/CHANGELOG.md)。

---

## 它解决什么问题

后端研发的日常痛点：

- **信息对齐成本高**：MRD 是产品语言，开发要自己翻译成技术方案，理解偏差很常见
- **单测覆盖率低**：不是不想写，是写起来太耗时，尤其是 mock 复杂依赖的时候
- **跨域需求难拆分**：一个需求同时涉及多个应用，每个应用得单独出方案，容易遗漏
- **知识靠人脑记**：老代码为什么这么设计，新人根本摸不着头脑

dev-workflow 把研发的五个核心步骤变成五个命令，每个命令背后是一组 Agent 自动执行：

```
/dev-workflow:00-init              环境初始化（一次性）
/dev-workflow:01-knowledge-base    构建应用知识库
/dev-workflow:02-implementation-plan  MRD → PRD + 技术方案
/dev-workflow:03-code-gen-tdd      代码 + 单测 + 自动纠错
/dev-workflow:04-archive           归档 + 知识库更新
```
![dev-workflow.png](dev-workflow.png)
---

## 核心特性

**五种自动纠错机制**（`/03-code-gen-tdd` 阶段）

| 机制 | 说明 |
|------|------|
| OpenSpec + TestSpec 双向比对 | 接口规格和测试规格互相比对，检查遗漏 |
| 编译纠正 | 编译报错自动反馈给 Agent，修复后重新编译 |
| 代码审查纠正 | 对照 CLAUDE.md 规范 Review，发现问题自动修改 |
| 单测未通过纠正 | 失败原因分析后自动修复，重新执行 |
| 覆盖率不足纠正 | 低于阈值时自动补充测试用例 |

**断点续传**：每个阶段完成后状态写入 `execution-state.md`，中途失败直接继续，不从头重跑。

**跨域支持**：一个 MRD 涉及多个应用时，自动路由分配、分别出方案、OpenSpec 保证接口对齐。

---

## 快速开始

详见 [QUICK_START.md](./docs/QUICK_START.md)

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [QUICK_START.md](./docs/QUICK_START.md) | 5 步上手指南 |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 架构设计说明 |
| [FEISHU_SETUP.md](./docs/FEISHU_SETUP.md) | 飞书集成配置（可选） |
| [CONTRIBUTING.md](./docs/CONTRIBUTING.md) | 贡献指南 |
| [CHANGELOG.md](./docs/CHANGELOG.md) | 版本记录 |
| [RELEASE_2026-05-21.md](./docs/RELEASE_2026-05-21.md) | v3.3.0 发布公告 |

---

## 前置依赖

- [Claude Code](https://claude.ai/code)（CLI）
- Java 8+、Maven 3.6+
- JUnit 4 或 JUnit 5（项目已有即可）

---

## 适用场景

✅ 后端服务类需求，有明确接口变更和业务逻辑

✅ 跨域需求，涉及多个 Spring Boot 应用

✅ 需要快速提升单测覆盖率的存量项目

❌ 纯配置变更、前端交互、算法调优（暂不适合）

---

## 交流方式
邮箱：153268908@qq.com
![wechat.jpg](wechat.jpg)
