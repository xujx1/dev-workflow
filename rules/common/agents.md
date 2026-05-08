# Agent 编排规则

## 可用 Agent

### 全局 Agent（`~/.claude/agents/`）

| Agent | 用途 | 触发时机 |
|-------|------|---------|
| planner | 实现规划 | 复杂功能、重构 |
| architect | 系统设计 | 架构决策 |
| tdd-guide | 测试驱动开发 | 新功能、bug 修复 |
| code-reviewer | 通用代码审查 | 通用项目的代码审查；**不得替代本流程中的 `java-review-agent`** |
| security-reviewer | 安全分析 | 提交前 |
| build-error-resolver | 修复构建错误 | 构建失败时 |

### 本项目 Agent（`agents/{agent-name}/`，一目录一职责）

| Agent | 目录 | 用途 | 触发时机 |
|-------|------|------|---------|
| java-impl-agent | `agents/java-impl/` | Java 功能实现 | Stage 3 Apply 阶段 |
| java-review-agent | `agents/java-review/` | Java 代码 Review | Stage 3 commit 后 |
| coverage-report-agent | `agents/coverage-report/` | JaCoCo 覆盖率报告 | 归档阶段 |
| prd-generator-agent | `agents/prd-generator/` | PRD 生成 | Stage 1 |
| mrd-reader-agent | `agents/mrd-reader/` | MRD 读取与澄清 | Stage 0 |
| tech-design-agent | `agents/tech-design/` | 技术方案生成 | Stage 2 |
| tdd-test-spec-agent | `agents/tdd-test-spec/` | TDD 测试规格 | Stage 3 Phase 1 |
| testcode-gen-agent | `agents/testcode-gen/` | 单元测试代码生成 | Stage 3 Phase 4 |
| tdd-test-runner-agent | `agents/tdd-test-runner/` | 测试执行与覆盖率诊断 | Stage 3 Phase 5 |
| kb-update-agent | `agents/kb-update/` | 三库回写 | Stage 4 |
| archive-report-agent | `agents/archive-report/` | 归档报告+飞书 | Stage 4 |

### 知识库 Agent

| Agent | 目录 | 用途 |
|-------|------|------|
| app-knowledge-agent | `agents/app-knowledge/` | 应用知识库构建 |

---

## 主动委托规则（无需用户提示）

1. 复杂功能请求 → 先用 **planner** 制定实现计划
2. 刚写/改完代码 → 立即用 **java-review-agent** 做 Review
3. 新功能/Bug修复 → 用 **tdd-guide** 指导先写测试
4. 架构决策 → 用 **architect** 分析权衡

---

## Skill 与 Agent 边界（硬约束）

1. Skill / orchestrator **只负责编排**：派发 Agent、传递上下文、等待结果、展示确认门、更新状态文件。
2. 只要某一步在 Skill 中已指定专职 Agent，**必须**调度该 Agent 执行；禁止在 Skill / orchestrator 中直接完成该 Agent 的正文工作。
3. 禁止因为流程复杂、步骤过多、上下文不足、模型能力差异或追求速度而合并多个 Agent 步骤、跳过中间 Phase、或用摘要/分析稿冒充正式产物。
4. 汇合阶段只允许：读取 Agent 返回值、校验约定产物是否已落盘、将路径和状态写入 `{feature_dir}/execution-state.md`。不允许重写 Agent 应负责生成的核心文件内容。
5. `04-code-gen-tdd` 特别约束：
   - `test_spec` 只能由 `tdd-test-spec-agent` 生成 / 补充
   - `Review` 只能由 `java-review-agent` 执行；禁止使用全局 `code-reviewer` 代替
   - 测试代码只能由 `testcode-gen-agent` 生成；禁止 orchestrator 直接 freestyle 生成
   - 测试执行只能由 `tdd-test-runner-agent` 执行；禁止裸 `mvn test` 代替
   - `test_file_list_*.md` 落盘前，orchestrator 禁止修改工程 `src/test/**`
6. 专职 Agent 派发失败处理 → **详见 `rules/common/agents-failure-handling.md`**

---

## 飞书文档读取协议（全局，所有 Skill / Agent 适用）

> ⚠️ **硬约束**：任何需要读取飞书文档的步骤，必须遵循以下优先级顺序：

1. **优先**：使用 **飞书 MCP**（`user-front/feishu` MCP server）直接读取文档内容
2. **降级**：仅在 MCP 工具不可用时，才允许调度 `feishu-doc-sync-agent` 读取，并在输出中注明降级原因
3. **禁止**：直接调用 `scripts/wiki_tools.py` 或其他本地脚本读取飞书文档

---

## 模型选择规则（Cost-Aware）

| 模型 | 适用任务 | 典型场景 |
|------|---------|---------|
| `haiku` | 轻量、高频、无推理 | 格式化、摘要、日志分析、instinct 提取 |
| `sonnet` | 主要开发任务 | 代码生成、Review、知识库构建、技术方案 |
| `opus` | 需要深度推理 | 架构决策、复杂业务规则分析、ADR 撰写 |

---

## 知识库注入（L0/L1/L2 分层，P0 硬约束）

> ⚠️ **P0 硬约束**：所有 Agent 必须遵守以下知识库注入规则，防止上下文爆炸。

### L0/L1/L2 结构（强制）

所有 `agents/*/*.md` 必须包含"知识库注入计划"小节：

- **L0 必读**：`{kb_path}/CONTEXT.md`（摘要层，≤200 行）
- **L1 条件读**：按 Agent 职责最多读 1 个详细文档（≤150 行），见下方映射表
- **L2 禁止读**：一次性 Read ≥2 个详细文档；Read 完整 tech-design.md（>500 行时只读前 200 行）；在 Task prompt 中内联任何 L1 层内容
- 总注入 ≤350 行

### L1 条件读映射表

| Agent | L1 条件读 | 何时触发 |
|-------|-----------|---------|
| prd-generator | `{kb_path}/01_业务与领域知识层.md` | 生成 PRD |
| tech-design | `{kb_path}/02_架构与设计层.md` | 生成技术方案 |
| java-impl | `{kb_path}/03_核心流程与逻辑层.md` | 生成代码 |
| testcode-gen | `{kb_path}/03_核心流程与逻辑层.md` | 生成测试 |
| java-review | 无（只读 git diff） | — |
| tdd-test-spec | `{kb_path}/02_架构与设计层.md` | 生成测试规格 |
| tdd-test-runner | 无（只读 test_spec） | — |

---

## 并行子 Agent 等待规则（强制）

> **详见 `rules/common/agents-parallel-wait.md`**

---

## Agent 返回格式规范（P0 Token 优化硬约束）

> ⚠️ **P0 硬约束**：所有子 Agent 完成后，**禁止返回文件全文**，只返回结构化摘要。Orchestrator 需要详情时自行 Read。

**返回格式**：

```json
{
  "status": "done",
  "file": "req/foo/tech-design/tech-design.md",
  "size": "12KB",
  "summary": "改动3模块/预估2人日/灰度:canary",
  "phase_count": 6,
  "story_count": 4
}
```

**规则**：`summary` ≤150 字符；禁止返回文件内容；禁止返回完整日志；Orchestrator 按需 Read。

---

## Orchestrator 禁止清单与 Phase 节奏控制（Token 优化硬约束）

> **详见 `rules/common/agents-orchestrator-constraints.md`**

> **Token 优化门禁检查脚本详见** `docs/state-protocol/gate-check-scripts.md`

---

## Learnings 机制（跨会话学习）

> 借鉴 GStack 的 `/learn` 机制，让 Agent 在多次会话中"记住"经验。

### 存储

- 文件路径：`{工程根}/app-knowledge-base/learnings.jsonl`
- 格式：JSONL（每行一条 JSON）

```json
{"ts":"2026-04-29T10:00:00Z","skill":"code-gen","type":"pitfall","key":"order-status-enum","insight":"OrderStatus 枚举有 7 个值，不要硬编码字符串","confidence":9,"source":"observed","files":["OrderStatus.java"]}
```

### 记录时机

| Agent | 记录时机 | type |
|-------|---------|------|
| java-impl | 发现坑点 / 特殊处理 | `pitfall` |
| tdd-test-spec | 发现测试模式 | `pattern` |
| java-review | 发现代码规范问题 | `preference` |
| tech-design | 发现架构决策 | `architecture` |

### 使用方式

```bash
# 搜索最近 5 条学习
python3 scripts/learnings-search.py --limit 5

# 搜索特定关键词
python3 scripts/learnings-search.py --query "order"

# 记录新学习
python3 scripts/learnings-log.py --skill code-gen --type pitfall --key "db-connection" --insight "数据库连接池需配置 timeout" --confidence 8
```

### 上下文加载规则

1. **Agent 启动时**：搜索最近 3 条相关学习（按 skill 或关键词）
2. **Agent 完成时**：记录发现的新学习（如有）
3. **定期清理**：运行 `python3 scripts/learnings-search.py --prune` 清理过期条目
