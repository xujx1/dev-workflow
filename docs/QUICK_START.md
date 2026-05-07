# 快速上手指南

> 5 步完成从零到全流程跑通。预计总耗时：首次约 2 小时（含知识库构建），后续需求约 30-60 分钟。

---

## 第一步：安装插件

在 Claude Code 中执行：

```bash
/plugin marketplace add https://github.com/xujx1/dev-workflow
```

安装完成后，将命令文件复制到 Claude Code 命令目录（IDEA 插件用户必须执行）：

```bash
mkdir -p ~/.claude/commands
cp ~/.claude/plugins/dev-workflow/commands/*.md ~/.claude/commands/
```

**推荐同时安装以下增强插件**（可选但建议）：

```bash
# Token 压缩，节省 57-78% 上下文（推荐）
brew install rtk && rtk init --global

# 实时调用链分析（代码 Review 阶段自动使用）
npm install -g gitnexus
```

---

## 第二步：初始化项目环境 

在你的 **Java 项目根目录**执行：

```
/dev-workflow:00-init
```

它会自动检测：Java 版本、Maven 路径、JUnit 版本（4 还是 5）、Mockito 是否引入。

完成后生成 `.mrd-to-code-config.json`（**不要提交到 Git**，每人本地各自生成）：

```json
{
  "env": {
    "java_version": "1.8.0_xxx",
    "maven_version": "3.9.x",
    "test_deps_junit_version": 4,
    "test_deps_mockito": true
  },
  "test_runtime": {
    "mode": "mock-first"
  }
}

```
> 一个应用做一次即可，后续不需要重复执行。
详情参考：[00-init](../examples/00-init)
---

## 第三步：构建知识库

```
/dev-workflow:01-knowledge-base
```

Agent 会扫描代码、分析结构，在项目根目录生成：

```
app-knowledge-base/
├── CONTEXT.md              ← Agent 首读入口
├── 00_概览.md
├── 01_业务与领域知识层.md
├── 02_架构与设计层.md
├── 03_核心流程与逻辑层.md
├── 04_工程与规范层.md
├── 05_运维与可观测性层.md
├── 06_演进与决策记录层.md
├── api-index.md            ← 接口聚合索引
├── db-schema.md
└── KB_FRESHNESS.md         ← 知识库保鲜度记录
```

> 知识库是所有后续步骤的基础。每次需求归档时自动增量更新，代码大改时建议重新全量构建。
详情参考：[01-knowledge-base](../examples/01-knowledge-base)
---

## 第四步：生成实施方案

准备好 MRD 后执行：

```
/dev-workflow:02-implementation-plan

mrd：<你的 MRD 文档地址或本地路径>

涉及应用：
/path/to/your-app-1
/path/to/your-app-2
```

Agent 会依次执行：

1. **需求归属**：判断哪些域、哪些应用涉及本次需求
2. **需求澄清**：基于知识库主动提问，补充 MRD 模糊点（等待你回答后继续）
3. **生成 PRD**：按域生成结构化 PRD
4. **生成技术方案**：为每个应用分别生成技术方案

> 中途可以中断，系统自动保存进度到 `req/{feature-name}/execution-state.md`，重新执行命令从断点继续。
详情参考：[02-implementation-plan](../examples/02-implementation-plan)
---

## 第五步：生成代码与单测

技术方案确认后执行：

```
/dev-workflow:03-code-gen-tdd
需求空间：@req/<feature-name>
```

执行顺序：

```
Phase 1: 生成测试用例规格（TestSpec）→ 人工确认
Phase 2: 生成业务代码
Phase 3: 代码审查（对照 CLAUDE.md 规范）
Phase 4: 生成单测代码
Phase 5: 执行单测 → 自动纠错直到通过
```

**五种自动纠错**全程无需干预，Agent 自动处理编译错误、审查问题、单测失败、覆盖率不足。

> 详情参考：[03-code-gen-tdd](../examples/03-code-gen-tdd)
---


---

## 第六步：归档

测试验收通过、发布前执行：

```
/dev-workflow:04-archive
需求空间：@req/<feature-name>
```

完成：锁定代码版本 + 增量更新知识库 + 生成需求归档报告。

> 详情参考：[04-archive](../examples/04-archive)
---
---

## 常见问题

**Q：上下文超限（Token 爆炸）怎么处理？**

不用重头来。执行 `/compact` 后重新启动命令，系统从 `execution-state.md` 断点恢复。

**Q：团队多人使用，环境怎么对齐？**

每人在自己机器上执行 `/dev-workflow:00-init`，各自生成本地配置，`.mrd-to-code-config.json` 不提交 Git。

**Q：飞书集成是必须的吗？**

不是必须的。飞书是可选的文档同步渠道，不配置时文档仅保存在本地。配置方法见 [FEISHU_SETUP.md](./FEISHU_SETUP.md)。

**Q：单测跑失败了怎么办？**

Agent 会自动分析失败原因并重试，最多执行 3 轮自动纠错。如果 3 轮后仍未通过，会输出详细失败报告供人工介入。
