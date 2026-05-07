# tech-design 详细执行规则

> 本文件由 `tech-design-agent.md` 骨架按需 Read。

> 通用执行规则（状态文件写入/并行派发/派发失败处理/Token 门禁）详见 `rules/common/execution-rules.md`。

## 步骤 1：并行读取资料

同时执行（并行）：
- `Read {prd_local_path}` — PRD 确认版
- `Read {feature_dir}/mrd-clarified.md` — MRD 澄清版（强制读取）
- `Read {kb_local_path}/CONTEXT.md`（强制）
- `Read {kb_local_path}/02_架构与设计层.md`
- `Read {kb_local_path}/03_核心流程与逻辑层.md`
- `Read {kb_local_path}/db-schema.md`（若存在）
- 探索项目涉改模块代码（按需）

**GitNexus 调用链（若 `l3_gitnexus=available`）**：

```
1. gitnexus_search({涉改核心模块关键词}) → 定位涉改核心类/接口
2. gitnexus_get_callers({核心接口/方法}) → 了解上游依赖
3. gitnexus_impact({涉改核心类名}) → 获取影响评级
```

查询结果写入：模块边界 → 「三、详细设计/模块影响」；高风险链 → 「五、稳定性与风险」；上游调用方 → 「六、灰度与发布建议」。

**autoresearch 深度调研（若涉及新技术栈或复杂架构决策）**：

```
Skill autoresearch "{调研主题}" → 返回结构化调研报告
```

## 步骤 2：生成技术方案

遵循 `docs/tech-design-template.md` 结构。

**必须补齐的估算附录**：
- 改动接口数、改动表数、新增/修改类数、涉及外部系统、估算人日、人工确认状态：待确认
- `估算人日` 是 TDD 测试模式选择的输入，必须给出首版值，不得留空

**图表格式强制要求**：

| 图示类型 | 格式 |
|---------|------|
| 业务流程图 | `flowchart TD` |
| 系统时序图 | `sequenceDiagram` |
| 状态机图 | `stateDiagram-v2` |
| 依赖关系图 | `flowchart LR` |

## 步骤 3：分章节写入

```
1. Write {feature_dir}/tech-design.md ← 仅章节标题
2. Edit 逐章节填充正文
```

`tech-design.md` 写入后永不覆盖（用户修改意见以追加章节方式进行）。

## 步骤 4：生成附录I — 需求拆解

读取 `assets/req-split-guide.md`（若存在），追加到 `tech-design.md` 末尾：

```markdown
## 附录I：需求拆解
### Story 列表
| Story ID | Story 标题 | 描述 | 工时（人日）|
### 开发任务分解
| 任务 ID | 所属 Story | 任务描述 | 负责模块 | 依赖任务 |
### 依赖关系 & 风险
### 待确认项
```

## 步骤 5：生成附录II — GitNexus 影响面分析

**分支A：`l3_gitnexus=available`**：
1. 从 tech-design.md 提取涉改接口/类/方法
2. 调用 `gitnexus_impact(class_or_method)`（降级顺序：MCP → CLI → 人工摘要）
3. 附录II 标题反映实际使用方式

**分支B：`l3_gitnexus=missing`**：
```markdown
## 附录II：变更影响分析（未执行，GitNexus 未安装）
> GitNexus 插件未安装，无法自动分析调用链影响面。
> 建议安装后重新生成：`claude mcp add gitnexus -- npx -y gitnexus@latest mcp`
```

## 步骤 6：生成附录III/IV

> ⚠️ 附录III 和附录IV 是 tech-design.md 的必要组成部分，不得跳过，无条件执行。

**附录III — 场景扩展（技术视角）**：
- 基于附录I Story + AC，生成不少于 5 个技术边界场景
- 聚焦：并发/幂等/事务回滚/MQ 消费重复/超时/部分失败等

**附录IV — 多视角架构分析**：
- 技术风险预判（性能/并发/兼容性维度）
- 架构方案对比：至少 2 种方案 + 收敛结论

## 步骤 7：验证检查

检查 tech-design.md 是否包含附录II/III/IV，不存在则立即补写，通过后输出确认门。
