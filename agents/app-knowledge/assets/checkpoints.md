# app-knowledge 扫描规则与检查点详情

## 第三步结束 — Context 压缩检查点（⚠️ 强制）

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
