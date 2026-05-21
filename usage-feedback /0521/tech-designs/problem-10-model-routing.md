# 技术方案：模型路由配置化

## 背景

当前 dev-workflow 各 Stage 使用的模型依赖用户运行时的默认模型，没有系统化的路由策略。模型选择靠人工判断，流程不稳定，也不利于团队复用。

同时还需要兼容单模型使用方：很多团队只有单一模型，或未执行完整初始化流程。模型路由不能假设所有人都有多 Provider、多模型可选，也不能因为缺少模型配置就中断主流程。

## 目标

1. 设计 Category 路由机制，把"能力等级"和"具体模型"解耦。
2. 支持按 Agent / Stage 配置模型优先级，提供降级链。
3. 兼容单模型使用方：退化为 baseline 单模型模式，流程不中断。
4. 支持风险驱动的自动模型升级（跨域需求、高风险链路、连续失败）。
5. 记录模型使用效果，用于后续路由策略优化。

---

## 方案设计

### Category 定义

模型路由通过 Category 表达任务能力需求，不在流程中写死具体模型名称：

| Category | 说明 | 适用场景 |
| --- | --- | --- |
| `deep` | 深度推理 | 技术方案、复杂代码实现、测试规格设计 |
| `quick` | 快速执行 | Review 规则检查、测试代码生成、归档整理 |
| `writing` | 文档写作 | PRD 生成、文档润色、归档报告 |
| `default` | 默认兜底 | 通用任务、未配置场景 |

### Stage → Category 映射

| Stage | Category | 说明 |
| --- | --- | --- |
| 知识库初扫（01） | `quick` | 文件扫描，成本优先 |
| MRD 澄清 / PRD（02 前期） | `writing` | 文档结构化 |
| 技术方案（02 后期） | `deep` | 复杂推理 |
| 核心代码实现（03） | `deep` | 编码能力 |
| 测试代码生成（03） | `quick` | 模板化生成 |
| Review / 风险分析（03） | `deep` | 审查能力 |
| 归档总结（04） | `writing` | 文档写作 |

### 模型解析优先级

```
用户显式覆盖（CLI --model 参数）
→ Agent 专属配置（.mrd-to-code-config.json 中 agents.xxx.model）
→ Agent → Category 映射（agents.xxx.category → category_models.xxx）
→ Category 首选模型（category_models.deep[0]）
→ Category 降级链（category_models.deep[1], [2]...）
→ 项目默认模型（defaults.model）
→ 环境 baseline 模型（运行时自动感知的可用模型）
```

### 配置文件结构

在 `.mrd-to-code-config.json` 中新增 `model_routing` 节：

```json
{
  "model_routing": {
    "enabled": true,
    "baseline_model": "claude-sonnet-4",
    "category_models": {
      "deep": ["claude-opus-4", "claude-sonnet-4"],
      "quick": ["claude-haiku-4", "claude-sonnet-4"],
      "writing": ["claude-sonnet-4"],
      "default": ["claude-sonnet-4"]
    },
    "stage_overrides": {
      "02-tech-design": {
        "category": "deep"
      },
      "04-archive": {
        "category": "writing"
      }
    },
    "risk_escalation": {
      "enabled": true,
      "triggers": ["cross_domain", "high_risk_chain", "consecutive_failures", "review_block_count>=2"],
      "escalate_to": "deep"
    }
  }
}
```

### 单模型兼容模式

当 `model_routing.enabled = false` 或 `category_models` 未配置时，退化为 baseline 单模型模式：

```
1. 读取 baseline_model（用户显式配置）或环境自动感知的可用模型。
2. 所有 Agent 使用同一个可用模型，流程不中断。
3. 在关键 Stage（tech-design、core impl）给出轻量提醒：
   "当前为单模型模式，配置 model_routing 可优化效果和成本"
4. 提醒只在 Stage 开始时显示一次，不重复打扰。
```

### 风险驱动自动升级

满足以下任一条件时，自动将当前 Stage 模型升级到 `deep` Category：

| 触发条件 | 说明 |
| --- | --- |
| `cross_domain` | 技术方案涉及跨应用依赖 |
| `high_risk_chain` | 涉及资金、库存、状态机等高风险链路 |
| `consecutive_failures` | 自动修复连续失败 ≥ 2 次 |
| `review_block_count >= 2` | Review 阶段 BLOCK 数 ≥ 2 |

升级时在 `execution-state.md` 记录：

```yaml
model_routing:
  current_stage: "03-code-gen"
  resolved_category: "deep"
  resolved_model: "claude-opus-4"
  escalation_reason: "consecutive_failures"
  escalation_at: "2026-05-21T10:30:00Z"
```

### 模型使用效果记录

每个 Stage 完成后，在 `.workflow/model-usage-log.jsonl` 追加一条记录：

```json
{
  "timestamp": "2026-05-21T10:30:00Z",
  "stage": "03-code-gen",
  "category": "deep",
  "model": "claude-opus-4",
  "tokens_input": 12000,
  "tokens_output": 3500,
  "duration_ms": 45000,
  "pass_first_attempt": false,
  "retry_count": 1,
  "review_block_count": 0,
  "human_edits": 0
}
```

该日志用于后续分析不同模型在各 Stage 的效果，反向优化路由策略。

---

## 文件变更清单

| 文件 | 变更说明 |
| --- | --- |
| `.mrd-to-code-config.json` | 新增 `model_routing` 配置节 |
| `.workflow/resolved-config.json` | 运行时合并后的模型路由配置 |
| `.workflow/model-usage-log.jsonl` | 运行时生成，记录模型使用效果 |
| `execution-state.md` | 新增 `model_routing` 状态字段 |
| `skills/mrd-to-code-v2/SKILL.md` | 新增模型路由加载和 baseline 退化说明 |
| `.workflow/scripts/model-resolver.js` | 新增，模型解析逻辑 |

---

## 验收标准

1. 多模型配置时，各 Stage 按 Category 映射选择正确的模型。
2. 单模型环境（或 `enabled=false`）时，流程不中断，只在关键 Stage 给出一次轻量提醒。
3. 触发风险升级条件时，Stage 模型自动升级为 `deep` Category，并在 `execution-state.md` 记录原因。
4. 每个 Stage 完成后，模型使用记录正确追加到 `.workflow/model-usage-log.jsonl`。

---

## 风险与注意事项

1. **模型名称变化**：具体模型名称随 provider 更新而变化，Category 机制将路由与模型名称解耦，降低维护成本。
2. **可用性感知**：Category 降级链应在运行时验证模型可用性，避免路由到不可用模型。
3. **成本控制**：`deep` Category 模型成本较高，风险升级机制需设合理阈值，避免频繁升级带来额外成本。
