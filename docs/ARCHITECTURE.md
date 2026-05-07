# 架构设计说明

> dev-workflow 是一套运行在 Claude Code 中的多 Agent 编排插件，核心设计目标：**每个阶段上下文隔离、失败可断点续传、质量可验证闭环**。

---

## 整体结构

```
dev-workflow/
├── SKILL.md                    ← 主编排器（全流程入口）
├── skills/                     ← 各阶段 Skill（子编排器）
│   ├── 00-init/
│   ├── 01-knowledge-base/
│   ├── 02-implementation-plan/
│   ├── 03-code-gen-tdd/
│   └── 04-archive/
├── agents/                     ← 原子 Agent（一目录一职责）
│   ├── app-knowledge/          ← 应用知识库生成
│   ├── mrd-clarify/            ← MRD 澄清
│   ├── prd-generator/          ← PRD 生成
│   ├── tech-design/            ← 技术方案生成
│   ├── tdd-test-spec/          ← 测试规格生成
│   ├── java-impl/              ← 代码实现
│   ├── java-review/            ← 代码审查
│   ├── testcode-gen/           ← 测试代码生成
│   ├── tdd-test-runner/        ← 测试执行
│   ├── coverage-report/        ← 覆盖率报告
│   ├── archive-report/         ← 归档报告
│   ├── kb-update/              ← 知识库更新编排
│   ├── instinct-extract/       ← 经验提取
│   └── feishu-doc-sync/        ← 飞书文档同步（可选）
├── rules/                      ← 规范标准（Java 编码规范等）
├── plugins/                    ← 插件（RTK、hooks、claude-md 等）
├── commands/                   ← Claude Code 命令文件
├── examples/                   ← 示例产物
└── mcp-configs/                ← MCP 服务器配置
```

---

## 流程架构

```
MRD 地址
  │
  ├─ [Stage 0]   mrd-clarify             → 需求澄清，等待确认
  ├─ [Stage 0.5] app-router              → 识别涉及应用，生成 apps.json
  ├─ [Stage 1+2] 02-implementation-plan  → PRD + 技术方案，等待评审
  ├─ [Stage 2*]  02-implementation-plan  → PRD 有变更时刷新技术方案（可选）
  ├─ [Stage 3]   03-code-gen-tdd
  │               ├─ Phase 1: TestSpec + OpenSpec（并行）→ 确认
  │               ├─ Phase 2: java-impl（代码实现）
  │               ├─ Phase 3: java-review（代码审查）
  │               ├─ Phase 4: testcode-gen（生成单测）
  │               └─ Phase 5: tdd-test-runner（执行 + 覆盖率）
  └─ [Stage 4]   04-archive              → 归档，手动触发
```

---

## 核心设计原则

### 1. 上下文隔离

每个 Stage 通过 Claude Code 的 `Task` 工具以独立子会话执行。子会话启动时上下文干净，不继承主会话历史。这是防止 Token 积累导致上下文超限的根本手段。

### 2. 状态持久化

每个阶段完成后，编排器将状态写入 `{feature_dir}/execution-state.md`，包含：
- 已完成的阶段标记
- 产物位置（本地路径或飞书 URL）
- 关键参数（commit hash、kb_path 等）

中断后重新启动命令时，从该文件恢复，跳过已完成步骤。

### 3. 知识库分层注入

禁止在编排器层全量注入知识库（会炸 Token）。采用 L0/L1/L2 三层策略：

| 层级 | 读取时机 | 读取内容 |
|------|---------|---------|
| L0 必读 | Agent 启动时 | `CONTEXT.md`（摘要，≤200 行） |
| L1 条件读 | 按职责按需 | 对应层文档（最多 1 个） |
| L2 禁止 | — | 禁止 Read ≥2 个详细文档 |

### 4. Token 门禁

每个 Stage 启动前检查上下文使用率：

| 使用率 | 动作 |
|--------|------|
| < 60% | 继续 |
| 60-80% | 提示执行 `/compact` |
| > 80% | 停止，必须 `/compact` 后继续 |

### 5. 质量闭环

代码生成阶段（Phase 2-5）形成自动闭环：

```
生成代码 → 编译检查 → 审查 → 生成单测 → 执行单测 → 覆盖率检查
    ↑________失败时自动回退修复_________________________________|
```

---

## Agent 职责一览

| Agent | 职责 | 输入 | 输出 |
|-------|------|------|------|
| `app-knowledge` | 应用知识库生成 | 代码目录 | `app-knowledge-base/` |
| `mrd-clarify` | 需求澄清问答 | MRD + 知识库 | `mrd-clarified.md` |
| `prd-generator` | PRD 生成 | 澄清后 MRD + 知识库 | `prd.md` |
| `tech-design` | 技术方案 | PRD + 知识库 | `tech-design.md` |
| `tdd-test-spec` | 测试规格 | 技术方案 | `test_spec.md` |
| `java-impl` | 代码实现 | 技术方案 + OpenSpec | git diff |
| `java-review` | 代码审查 | git diff + CLAUDE.md | `code-review.md` |
| `testcode-gen` | 测试代码生成 | `test_spec.md` | 单测 Java 文件 |
| `tdd-test-runner` | 测试执行 | 单测文件 | 测试报告 + jacoco.exec |
| `coverage-report` | 覆盖率分析 | jacoco.exec | 覆盖率摘要 |
| `archive-report` | 归档报告 | 各阶段产物 | `archive-report.md` |
| `kb-update` | 知识库增量更新 | git diff + 归档信息 | 更新后的知识库 |

---

## 飞书集成（可选）

飞书相关 Agent（`feishu-doc-sync`、`mrd-reader`、`archive-report` 的上传功能）完全可选。

未配置飞书时：
- MRD 从本地文件读取（替代飞书读取）
- PRD、技术方案仅保存本地，不上传
- 归档报告仅本地生成

配置方法见 [FEISHU_SETUP.md](./FEISHU_SETUP.md)。

---

## MCP 服务器配置

推荐配置的 MCP 服务器（`mcp-configs/mcp-servers.json`）：

| 服务器 | 用途 |
|--------|------|
| `github` | PR、Issue 操作 |
| `context7` | Java/Spring Boot 实时文档查询 |
| `sequential-thinking` | 架构决策链式推理 |
| `feishu`（可选） | 飞书文档读写 |
| `gitnexus`（可选） | 代码调用链分析 |
