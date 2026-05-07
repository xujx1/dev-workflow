# dev-workflow

> 一套跑在 Claude Code 里的 Java TDD 全流程自动化插件。从 MRD 到可跑通单测的代码，全程 AI 驱动，人在关键节点确认。

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

## License

MIT
