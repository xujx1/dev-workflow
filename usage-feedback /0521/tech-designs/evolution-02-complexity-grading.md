# 技术方案：需求复杂度分级

## 背景

当前 dev-workflow 对所有需求都执行相同的完整流程（知识库 + 技术方案 + OpenSpec + TDD + GitNexus + 完整归档），导致：

1. 小需求（字段改名、简单 if 分支、文案修改）也要承担全流程成本，上手门槛高。
2. 高风险需求（跨应用、资金链路、多人协作）缺少强制的额外治理手段。
3. 没有基于"规模 + 风险 + 协作"的自动档位判断，全靠人工决策。

## 目标

1. 定义三档复杂度：`nano`、`lite`、`full`，明确各档适用场景和流程差异。
2. 技术方案阶段自动判断并输出推荐档位及依据。
3. 各 Stage（OpenSpec、GitNexus、归档）根据档位决定是否启用。
4. 支持从低档升级到高档（升级宽松），高档降低档需人工确认（降级严格）。

---

## 方案设计

### 三档定义

| 档位 | 适用场景 | 流程差异 |
| --- | --- | --- |
| `nano` | 文案修改、字段命名、简单校验、小 if 分支 | tech-only + 单元测试；跳过知识库更新、OpenSpec、GitNexus、完整归档 |
| `lite` | 常规单应用需求、单模块改动 | 知识库 + 技术方案 + TDD；OpenSpec 可选，GitNexus 可选，标准归档 |
| `full` | 跨应用、高风险链路、多人协作需求 | 完整流程：OpenSpec 强制 + GitNexus 强制 + 完整归档 + 风险分析 |

### 档位判断规则

技术方案阶段根据以下维度综合判断推荐档位：

#### 规模维度

| 指标 | nano | lite | full |
| --- | --- | --- | --- |
| 预估人日 | < 0.5 | 0.5 ~ 3 | > 3 |
| 涉及文件数 | ≤ 3 | 4 ~ 15 | > 15 |
| 涉及应用数 | 1（局部改动） | 1 | > 1 |

#### 风险维度

| 风险类型 | 影响 |
| --- | --- |
| 涉及资金、库存、状态机 | 强制升级到 full |
| 涉及数据一致性（分布式事务） | 强制升级到 full |
| 涉及对外 API 接口变更 | 升级到 lite 或 full |
| 涉及权限边界变更 | 升级到 lite |

#### 协作维度

| 协作范围 | 影响 |
| --- | --- |
| 跨团队需求 | 升级到 full |
| 多应用需求 | 升级到 full |
| 单团队单应用 | 维持 lite |

### 档位输出格式

技术方案阶段在 `execution-state.md` 写入：

```yaml
complexity:
  level: lite                      # nano / lite / full
  reasons:
    - single_app_change
    - estimated_days_1.5
    - no_external_contract_change
  risk_triggers: []
  collaboration_scope: single_team
  recommended_flow:
    knowledge_base: true
    openspec: optional             # true / optional / false
    gitnexus: optional             # true / optional / false
    archive: standard              # standard / full / skip
```

### 各档位流程差异

| 流程节点 | nano | lite | full |
| --- | --- | --- | --- |
| 知识库梳理（01） | 跳过 | 执行 | 执行 |
| MRD 澄清 / PRD | 跳过（tech-only） | 执行 | 执行 |
| 技术方案 | 简化版 | 标准版 | 完整版 |
| OpenSpec（Stage 2.5） | 跳过 | 按触发规则决定 | 强制执行 |
| 代码生成 + TDD | 执行 | 执行 | 执行 |
| GitNexus 影响分析 | 跳过 | 可选 | 强制 |
| 归档（04） | 轻量归档 | 标准归档 | 完整归档（含需求报告） |

### 档位升降级规则

```
升级（宽松）：
- 执行中发现风险比技术方案判断高（如发现跨应用依赖、高风险字段），可自动或由 Agent 提示后升级。
- 升级后追加对应流程节点（如触发 OpenSpec、启用 GitNexus）。

降级（严格）：
- 降级必须人工确认，不允许自动降级。
- 降级时 Agent 输出降级依据和潜在风险，等待用户确认后执行。
- 典型场景：技术方案判断为 full，但用户确认实际只改了 1 个文件且无风险，手动降为 lite。
```

### 档位集成到 Orchestrator

Orchestrator 在以下节点读取 `complexity.level`：

- Stage 2.5（OpenSpec）：`lite` 且触发规则成立时执行，`full` 时强制，`nano` 时跳过。
- Stage 3（GitNexus）：`full` 时强制，`lite` 时可选，`nano` 时跳过。
- Stage 4（归档）：`nano` 时只更新知识库不生成报告，`full` 时生成完整需求跟踪报告。

---

## 文件变更清单

| 文件 | 变更说明 |
| --- | --- |
| `execution-state.md` | 新增 `complexity` 字段 |
| `skills/mrd-to-code-v2/02-implementation-plan/SKILL.md` | 新增档位判断逻辑说明 |
| `skills/mrd-to-code-v2/SKILL.md` | 新增根据档位路由流程节点说明 |

---

## 验收标准

1. `nano` 需求：tech-only 模式跑通，不触发知识库、OpenSpec、完整归档。
2. `lite` 需求：标准流程跑通，OpenSpec 按触发规则执行。
3. `full` 需求：OpenSpec 和 GitNexus 强制执行，生成完整归档报告。
4. 运行中发现风险升级时，Agent 提示并追加对应流程节点，`execution-state.md` 中 `complexity.level` 更新。
5. 降级必须经过人工确认，Agent 不自动降级。

---

## 风险与注意事项

1. **误判档位**：`nano` 档位的风险在于低估需求，Agent 需在技术方案阶段明确列出档位判断依据，方便人工复核。
2. **nano 升级触发时机**：代码实现中发现跨文件改动超过预期时，应及时升级档位并补充对应治理步骤。
3. **first-time 使用方**：对于第一次使用 dev-workflow 的团队，建议默认从 `lite` 起步，不建议直接从 `nano` 开始，避免误判风险。
