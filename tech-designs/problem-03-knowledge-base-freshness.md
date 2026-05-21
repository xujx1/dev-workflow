# 技术方案：知识库分层结构与保鲜机制

## 背景

当前 dev-workflow 的应用知识库（L0 CONTEXT.md、L1 域知识、L2 测试知识）在需求迭代后存在过时问题。知识库的更新依赖人工触发归档流程，在快速迭代或多需求并行时容易积压滞后。

核心问题：
1. 知识库三层边界模糊，内容容易跨层越界。
2. 没有内置的"保鲜检测"机制，过时内容不会自动报警。
3. 归档流程是全量更新，代价高，执行频率低。

## 目标

1. 明确 L0 / L1 / L2 的边界定义与内容规范。
2. 建立基于 git 变更感知的增量保鲜检测机制。
3. 引入"新鲜度分"（Freshness Score），量化知识库滞后程度。
4. 支持"轻量 refresh"路径，用增量更新替代全量归档。

---

## 方案设计

### 三层定义与内容规范

#### L0：CONTEXT.md（应用全局上下文）

- **边界**：应用级不变量（架构概述、核心模块职责、主要技术栈、团队约定）。
- **更新频率**：每次重大需求归档后，若模块职责或架构发生变化则更新。
- **大小上限**：200 行（超出则拆分子模块）。
- **禁止内容**：具体业务 PRD 细节、接口参数、测试用例。

#### L1：域知识库（按域拆分）

- **边界**：领域模型、关键业务规则、接口契约摘要、已知约束。
- **文件组织**：`knowledge-base/domain/{domain-name}/overview.md`。
- **更新频率**：每个域的需求归档后更新。
- **禁止内容**：实现细节代码片段、测试数据。

#### L2：测试知识库

- **边界**：测试策略、关键 mock 规范、核心测试场景摘要。
- **文件组织**：`knowledge-base/test/{domain-name}/test-spec-summary.md`。
- **更新频率**：每次代码生成 + 测试阶段完成后增量追加。
- **禁止内容**：完整测试代码、生产数据。

### 保鲜检测机制

#### 滞后判断规则

```
每次「归档」流程执行时，检测：
1. 距上次 CONTEXT.md 更新后，累计有多少 git commit 涉及被 CONTEXT.md 描述的模块。
2. 若涉及模块的 commit 数量 > threshold（默认 5），触发 freshness 警告。
3. 按域统计 L1 知识库与最新 PRD 的字段覆盖度（用 diff 关键词匹配）。
```

#### Freshness Score 计算

```
freshness_score = 100 - (outdated_commits / total_relevant_commits) * 100

outdated_commits: 归档后未触发知识库更新的 commit 数量（按模块路径匹配）
total_relevant_commits: 同时间段内该模块的总 commit 数量
```

| 分数 | 状态 | 建议动作 |
| --- | --- | --- |
| 80-100 | FRESH | 无需操作 |
| 60-79 | STALE_WARN | 下次归档时强制执行增量 refresh |
| < 60 | STALE_BLOCK | 触发全量知识库重建（归档前阻断） |

### 增量 Refresh 路径

触发条件：`freshness_score` < 80 时，归档流程在全量更新前先尝试增量 refresh：

```
Step 1: 读取 git log 中自上次归档以来的 commit 列表
Step 2: 提取涉及的模块路径（按文件路径匹配 CONTEXT.md 中的模块描述）
Step 3: 对涉及模块，逐模块执行轻量 refresh（只更新该模块的描述段落）
Step 4: 更新 freshness metadata 并写入 knowledge-base/freshness.yml
```

### Freshness 元数据文件

写入 `knowledge-base/freshness.yml`：

```yaml
last_full_refresh: "2026-05-10T08:00:00Z"
freshness_score: 82
modules:
  - name: "order-service"
    last_refresh: "2026-05-15T10:00:00Z"
    score: 90
    outdated_commits: 2
  - name: "payment-service"
    last_refresh: "2026-05-01T08:00:00Z"
    score: 55
    outdated_commits: 11
    status: "STALE_BLOCK"
```

---

## 文件变更清单

| 文件 | 变更说明 |
| --- | --- |
| `knowledge-base/freshness.yml` | 新增，保鲜元数据 |
| `.workflow/scripts/freshness-check.js` | 新增，保鲜检测核心逻辑 |
| `skills/mrd-to-code-v2/skills/04-archive/SKILL.md` | 归档流程前增加 freshness check 步骤 |
| `.mrd-to-code-config.json` | 新增 `knowledge_base.freshness_threshold`、`stale_block_threshold` 配置项 |

---

## 验收标准

1. 每次归档时，freshness check 自动运行，输出 freshness_score 及各模块状态。
2. `freshness_score` < 60 时，归档流程阻断，要求先执行知识库重建。
3. 增量 refresh 路径可正确识别涉及模块并只更新对应段落。
4. `knowledge-base/freshness.yml` 在每次归档后更新，格式符合规范。

---

## 风险与注意事项

1. **路径匹配误差**：模块路径匹配依赖文件路径约定，若团队路径不规范，匹配覆盖度会偏低。
2. **大规模重构**：全量重构时 outdated_commits 可能激增，导致误报 STALE_BLOCK，需增加"重构豁免标签"机制。
3. **知识库内容质量**：增量 refresh 只能更新描述，不能替代人工的语义校准；高风险域建议定期人工 review。
