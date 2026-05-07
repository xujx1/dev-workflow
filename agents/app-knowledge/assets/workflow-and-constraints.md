# 应用知识库生成 Agent — 工作流程与约束

## 输入

| 参数 | 必须 | 说明 |
|------|------|------|
| `project_path` | 是 | 工程根目录（含 pom.xml） |
| `kb_output_path` | 否 | 知识库输出目录（默认 `app-knowledge-base/`） |
| `mode` | 否 | `nano`（冷启动 2 文件）/ `lite`（默认 ~8 文件）/ `full`（完整 6 层） |

### mode 产出对齐（与 SKILL.md 硬约束）

| mode | 产出文件 | 适用场景 |
|------|---------|---------|
| `nano` | CONTEXT.md + api-index.md（共 2 个）| 新应用冷启动，只需接口列表 |
| `lite` ⭐ 默认 | CONTEXT.md + api-index.md + KB_INDEX.md + component-index.md + db-schema.md（若有）+ 01~03 层文档（共 ~8 个）| 所有场景统一入口 |
| `full` | 完整 6 层文档（00~06）+ 所有索引 | 深度梳理需求 |

## 工作流程

### 第一步：确认工程路径

```bash
[ -f "{project_path}/pom.xml" ] && echo "PROJECT_OK" || echo "PROJECT_MISSING"
```

### 第二步：代码结构全扫描（核心主干）

> 详细步骤见 `assets/step2-code-scan.md`，按需 Read。

核心动作：
- 模块结构识别
- 服务入口统计
- 领域模型提取
- 业务流程链识别
- 外部依赖识别
- 代码规范提取

### 第三步：数据库结构扫描

> 详细步骤见 `assets/step3-db-scan.md`，按需 Read。

触发条件：发现 `generatorConfig.xml` 时强制执行。

> ⚠️ **落盘硬约束**：第三步执行完成后，**必须将扫描结果落盘为 `{kb_output_path}/db-schema.md`**（格式见 `step3-db-scan.md` § 3步输出）。禁止只把结果写入其他文档内嵌片段而不生成独立文件。400张以上大表工程只保留关键词匹配的核心业务表（≤30张），其余列清单摘要（表名 + 一句话业务用途），总行数 ≤400 行。

### 第三步结束 — Context 压缩检查点（⚠️ 强制）

> **触发条件**：第三步完成后（db-schema.md 已落盘），无论 mode 如何，**必须**执行以下检查：
>
> 1. 确认 `db-schema.md` 已写入磁盘（用 `[ -f ... ]` 检查，**不要读取文件内容**）
> 2. 清除第三步积累的数据库查询结果（仅保留"表数量 + 核心表清单"摘要，不保留字段详情）
> 3. 若 db-schema.md 生成行数 ≥200 行，**立即在此暂停并提示用户执行 `/compact`**，压缩后再继续后续步骤
>
> 暂停提示格式：
> ```
> ⚠️ Context 过载预警
> db-schema.md 已生成（N 行），累计上下文较大。
> 建议：输入 /compact 压缩上下文后继续执行 Step 4-7，
> 或直接回复"继续"跳过压缩（大工程可能触发 Prompt too long）。
> ```

### 第四步：可选补充 — APM 接口性能数据

> 需提供 APM 查询配置，否则跳过。

### 第五步：可选补充 — 飞书文档

> 需提供飞书文档 URL，否则跳过。

### 第六步：生成分层架构文档

> 文档模板见 `assets/doc-templates.md`，按需 Read。
>
> ⚠️ **Token 控制（P0）**：每层文档写入磁盘后**立即从上下文清除**（不保留在内存中）；每层文档 ≤300 行；`mode=lite` 时每层 ≤150 行。
>
> ⚠️ **mode 产出约束（P0）**：
> - `mode=nano`：跳过本步骤（不生成层级文档）
> - `mode=lite`：仅生成 01~03 层 + KB_INDEX.md（跳过 04~06）
> - `mode=full`：生成完整 00~06 层

产出文件：
- `00_概览.md`（CONTEXT.md 别名）
- `01_业务与领域知识层.md`
- `02_架构与设计层.md`
- `03_核心流程与逻辑层.md`
- `04_工程与规范层.md`
- `05_数据库设计层.md`
- `06_演进与决策记录层.md`

### 第七步：生成接口聚合索引（api-index.md）

> 高风险接口 + 按场景分组 + 全量接口简表。
>
> ⚠️ **Token 控制（P0）**：本步骤**只基于第二步内存摘要**生成索引，禁止重新 Read/扫描任何 .java 文件。api-index.md **总行数 ≤150 行**，超出则截断至150行并在末尾注明「已截断，完整列表见 02_架构与设计层.md」。

## 最终检查（强制）

```bash
# 检查必需文件是否存在
[ -f "{kb_output_path}/00_概览.md" ] || echo "❌ 缺少 00_概览.md"
[ -f "{kb_output_path}/CONTEXT.md" ] || ln -s 00_概览.md CONTEXT.md
[ -f "{kb_output_path}/api-index.md" ] || echo "❌ 缺少 api-index.md"
[ -f "{kb_output_path}/component-index.md" ] || echo "❌ 缺少 component-index.md（第二步扫描后必须生成）"
# 有数据库扫描时检查 db-schema.md
[ -f "{kb_output_path}/db-schema.md" ] || echo "⚠️ db-schema.md 未生成（若有 generatorConfig.xml 则为异常）"
```

> ⚠️ **必须确保 `CONTEXT.md` 存在**，否则后续 Agent 无法读取摘要层。
>
> ⚠️ **完成汇报格式（Agent 返回给 orchestrator 时必须包含）**：
> ```
> app-knowledge-agent 完成
> - CONTEXT.md: ✅/❌
> - api-index.md: ✅/❌
> - component-index.md: ✅/❌
> - db-schema.md: ✅/❌/N/A（无 generatorConfig.xml）
> - 6层文档: ✅/❌
> ```
> orchestrator（SKILL.md Step 4）依赖此汇报判断是否写入 KB_FRESHNESS.md。

## 产出

| 文件 | 路径 | nano | lite ⭐ | full |
|------|------|------|---------|------|
| 知识库概览 | `{kb_output_path}/CONTEXT.md` | ✅ | ✅ | ✅ |
| 接口索引 | `{kb_output_path}/api-index.md` | ✅ | ✅ | ✅ |
| 知识库索引 | `{kb_output_path}/KB_INDEX.md` | ❌ | ✅ | ✅ |
| 组件索引 | `{kb_output_path}/component-index.md` | ❌ | ✅ | ✅ |
| 数据库结构 | `{kb_output_path}/db-schema.md` | ❌ | ✅（若有）| ✅（若有）|
| 01_业务与领域知识层 | `{kb_output_path}/01_*.md` | ❌ | ✅ | ✅ |
| 02_架构与设计层 | `{kb_output_path}/02_*.md` | ❌ | ✅ | ✅ |
| 03_核心流程与逻辑层 | `{kb_output_path}/03_*.md` | ❌ | ✅ | ✅ |
| 04_工程与规范层 | `{kb_output_path}/04_*.md` | ❌ | ❌ | ✅ |
| 05_数据库设计层 | `{kb_output_path}/05_*.md` | ❌ | ❌ | ✅ |
| 06_演进与决策记录层 | `{kb_output_path}/06_*.md` | ❌ | ❌ | ✅ |

## 约束

- **CONTEXT.md 必须 ≤200 行**：作为后续 Agent 的摘要层入口
- **按需读取 assets**：执行时按需 Read 对应 step 文件，不一次性加载
- **禁止重复生成**：已存在的文档不覆盖（除非显式指定 `--force`）
