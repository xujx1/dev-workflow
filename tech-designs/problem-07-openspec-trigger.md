# 技术方案：OpenSpec 触发条件精细化

## 背景

当前 dev-workflow 的 OpenSpec 集成（Stage 2.5）触发条件是：需求估算 ≥ 5 人日时自动弹出确认门。

实践中发现这个阈值过于粗糙：
1. 某些 3 人日的需求涉及复杂接口变更，不生成 OpenSpec 会导致实现偏差。
2. 某些 10 人日的需求只是大量简单增删改，OpenSpec 生成成本高但价值低。
3. 不同业务域的接口稳定性差异大，不应用统一阈值。

## 目标

1. 将 OpenSpec 触发条件从"单一人日阈值"升级为"多维触发规则"。
2. 支持按业务域配置不同触发阈值。
3. 提供强制触发和强制跳过的命令行开关，满足边界场景。
4. 触发决策可追溯，写入 `execution-state.md`。

---

## 方案设计

### 多维触发规则

OpenSpec 触发条件改为以下规则的 OR 组合，任意一条成立则触发：

| 规则 ID | 触发条件 | 说明 |
| --- | --- | --- |
| RULE_01 | 需求估算 ≥ threshold（默认 5 人日） | 人日阈值，可按域覆盖 |
| RULE_02 | 技术方案中存在"新增 API"声明 | 新接口必须生成 OpenSpec |
| RULE_03 | 技术方案中存在"修改已有 API 入参/出参" | 接口变更必须生成 OpenSpec |
| RULE_04 | 技术方案中存在跨系统接口依赖声明 | 跨系统接口变更影响大 |
| RULE_05 | 业务域标记为 `openspec_required: always` | 指定域强制生成 |

**明确不触发 OpenSpec 的场景**（优先级高于上述规则）：

- 技术方案中只有内部逻辑修改（无接口变更）
- 需求类型为 `bug_fix`，且不涉及接口变更
- 业务域标记为 `openspec_required: never`

### 触发规则配置

在 `.mrd-to-code-config.json` 中配置触发阈值：

```json
{
  "openspec": {
    "default_threshold_days": 5,
    "domains": {
      "order-domain": {
        "threshold_days": 3,
        "openspec_required": "always"
      },
      "internal-tool": {
        "openspec_required": "never"
      }
    },
    "rules": {
      "RULE_02": true,
      "RULE_03": true,
      "RULE_04": true
    }
  }
}
```

### 触发决策流程

```
Step 1: 读取技术方案，提取估算人日、接口变更声明、跨系统依赖声明
Step 2: 读取 .mrd-to-code-config.json 中该业务域的配置
Step 3: 按规则逐项判断，收集命中的规则列表
Step 4: 若 openspec_required=never，跳过（强制不触发）
Step 5: 若任意规则命中 或 openspec_required=always，触发 OpenSpec
Step 6: 触发决策写入 execution-state.md，记录命中的规则和原因
```

### execution-state 新增字段

```yaml
openspec:
  triggered: true
  trigger_rules:
    - rule_id: "RULE_02"
      reason: "技术方案声明新增 API: POST /orders/batch"
    - rule_id: "RULE_01"
      reason: "估算人日: 7，超过阈值: 5"
  skipped: false
  skip_reason: null
```

### 命令行开关

```bash
# 强制触发 OpenSpec（无论规则）
$BD_BIN run --force-openspec

# 强制跳过 OpenSpec（无论规则）
$BD_BIN run --skip-openspec

# 查看触发决策报告
$BD_BIN openspec-decision
```

---

## 文件变更清单

| 文件 | 变更说明 |
| --- | --- |
| `.mrd-to-code-config.json` | 新增 `openspec` 配置块（threshold_days、domains、rules） |
| `skills/mrd-to-code-v2/plugins/openspec/SKILL.md` | 触发条件升级为多维规则，增加 execution-state 记录 |
| `execution-state.md` | 新增 `openspec.triggered`、`openspec.trigger_rules` 字段 |
| `skills/mrd-to-code-v2/SKILL.md` | 新增 `--force-openspec`、`--skip-openspec` 命令说明 |

---

## 验收标准

1. 满足任意触发规则时，OpenSpec 自动触发，且 `execution-state.md` 记录了命中的规则和原因。
2. `openspec_required: never` 的域，即使满足人日阈值也不触发 OpenSpec。
3. `--force-openspec` 和 `--skip-openspec` 开关可覆盖规则判断。
4. 触发决策报告可通过命令查看，格式清晰。

---

## 风险与注意事项

1. **接口变更识别准确性**：RULE_02/RULE_03 依赖技术方案中的接口声明格式，若技术方案格式不规范，规则可能漏判。建议在技术方案模板中固化接口声明格式。
2. **规则误判代价**：误触发 OpenSpec 代价是多消耗一轮 token 和时间；漏触发代价是接口实现偏差。两者权衡，建议 RULE_02/RULE_03 保持强制开启。
3. **人工干预记录**：使用 `--force-openspec` 或 `--skip-openspec` 时，需在 execution-state 中记录操作人和原因，保证可追溯。
