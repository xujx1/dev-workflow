# 04-archive — 归档执行步骤详情

> 由 `SKILL.md` 按需 Read。本文件包含 Step 4-init 至 Step 4-5 的完整执行流程与落盘脚本。

---

## 配置文件自愈（Step -1）

在执行归档链路之前，先读取 `.mrd-to-code-config.json` 的 `plugin_availability` 字段。若文件不存在或字段缺失，所有标志位默认 `unavailable`，不影响主流程。

> 如需安装插件，请运行：`/dev-workflow:00-init`

---

## Step 4-init: 初始化归档阶段表

追加至 `execution-state.md`（不覆盖已有内容）：

```bash
python3 -c "
import pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
changed = False
if '## 归档阶段' not in c:
    c += '''

    ---

    ## 归档阶段

    | 阶段 | 状态 | 产出 | 完成时间 | 消耗Token |
    |------|------|------|---------|---------|
    | Step 4-0.5 代码快照 | ⏳ 待执行 | archive_code_ref | — | — |
    | Step 4-1 OpenSpec 归档 | ⏳ 待执行 | spec/ | — | — |
    | Step 4-2 知识库更新 | ⏳ 待执行 | app-knowledge-base/ | — | — |
    | Step 4-3~4-4 归档报告 | ⏳ 待执行 | archive-report.md | — | — |
    | Step 4-5 本能提取 | ⏳ 待执行 | instincts/ | — | — |
    '''
    changed = True
if '## Archive Checklist' not in c:
    c += '''

---

## Archive Checklist

- [ ] step4-0.5-code-snapshot
- [ ] step4-1-openspec-archive
- [ ] step4-2-kb-update
- [ ] step4-3-4-archive-report
- [ ] step4-5-instinct-extract
'''
    changed = True
if changed:
    pathlib.Path(f).write_text(c, encoding='utf-8')
    print('Archive stage table / Checklist initialized')
else:
    print('Archive stage already initialized, skipped')
"
```

---

## Step 4-0.5: 锁定归档代码快照

> Token 优化：在任何 Agent spawn 之前执行 git 命令，避免主会话上下文饱和后再执行报错

1. 先执行 `git rev-parse --verify --quiet {ai_commit_hash}^{commit}` 校验 AI 基线
2. 执行 `git rev-parse HEAD`，记录 `archive_code_ref`
3. 再执行 `git rev-parse --verify --quiet {archive_code_ref}^{commit}` 校验归档快照
4. 若 `archive_code_ref != ai_commit_hash`，标记 `post_ai_commits=true`
5. 若 `ai_commit_hash` 不可解析，记录 `ai_commit_resolved=false`，归档报告节4写 `—` 而非 `0%`
6. 后续知识库归档与归档报告中的代码事实均以 `archive_code_ref` 为准
7. `ai_commit_hash` 仅继续用于"AI 代码采纳率"对比基线

### 落盘

```bash
python3 -c "
import re, datetime, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
tokens = '{session_token_count}'
c = re.sub(
    r'(\| Step 4-0\.5 代码快照 \| )⏳ 待执行( \| )archive_code_ref( \| )—( \| )—( \|)',
    rf'\g<1>✅ 已完成\2{archive_code_ref}\3{now}\4{tokens}k\5',
    c
)
c = c.replace('- [ ] step4-0.5-code-snapshot', '- [x] step4-0.5-code-snapshot')
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Step 4-0.5 state written')
"
```

---

## Step 4-1: OpenSpec 归档（conditional）

**触发条件**（满足任一）：
1. `execution-state.md` 中 `openspec_change_path` 字段非空 → 以 `openspec_change_path` 的末级目录名作为 `change_name`
2. 用户传入非空 `change_name`
3. 工程根 `spec/` 目录存在

若以上条件均不满足 → **直接跳过 Step 4-1，不得阻塞后续归档**

**OpenSpec 模式执行步骤**：
1. 读取 `{openspec_change_path}/verify-report.md`（若存在），确认 verify_result=PASS 或 PASS_WITH_WARNINGS
2. 执行 `/opsx:archive {change_name}`：将 specs/ 同步到 `openspec/specs/`，change 移至 archive
3. 验证归档结果：`openspec/changes/archive/{change_name}/` 目录已创建

### 落盘

```bash
python3 -c "
import re, datetime, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
tokens = '{session_token_count}'
# executed=True 时写已完成，executed=False 时写已跳过
if {openspec_executed}:
    c = re.sub(
        r'(\| Step 4-1 OpenSpec 归档 \| )⏳ 待执行( \| )spec/( \| )—( \| )—( \|)',
        rf'\g<1>✅ 已完成\2spec/\3{now}\4{tokens}k\5',
        c
    )
else:
    c = re.sub(
        r'(\| Step 4-1 OpenSpec 归档 \| )⏳ 待执行( \| )spec/( \| )—( \| )—( \|)',
        rf'\g<1>⏭️ 已跳过\2—\3{now}\4—\5',
        c
    )
c = c.replace('- [ ] step4-1-openspec-archive', '- [x] step4-1-openspec-archive')
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Step 4-1 state written')
"
```

---

## Step 4-2: 知识库更新（不得跳过）

调度 `kb-update-agent`：

- 更新应用知识库（按变更类型，6 类文档）
- 输入必须包含 `archive_code_ref`
- 若知识库内容与旧版 PRD/技术方案描述冲突，以 `archive_code_ref` 对应代码事实为准，并补充"最终实现差异"摘要

必须等待 kb-update-agent 完成并返回后，才能启动 Step 4-3

### 落盘

```bash
python3 -c "
import re, datetime, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
tokens = '{session_token_count}'
c = re.sub(
    r'(\| Step 4-2 知识库更新 \| )⏳ 待执行( \| app-knowledge-base/ \| )—( \| )—( \|)',
    rf'\g<1>✅ 已完成\2{now}\3{tokens}k\4',
    c
)
c = c.replace('- [ ] step4-2-kb-update', '- [x] step4-2-kb-update')
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Step 4-2 state written')
"
```

---

## Step 4-3~4-4: 生成归档报告 + 上传飞书 + commit

调度 `archive-report-agent`：

- 生成需求跟踪报告（本地文件固定为 `{feature_dir}/archive-report.md`）
- 读取 `{feature_dir}/execution-state.md`「过程数据」中的主要读取路径与阶段结论
- 报告中的最终代码事实与归档口径必须引用 `archive_code_ref`
- **节2（AI PRD 功能覆盖度）**：从 `execution-state.md` 读取 `prd_feishu_url`，调用 MCP `mcp__front_feishu__feishu_get_doc_content(prd_feishu_url)` 获取飞书最新 PRD 内容做覆盖度对比
- 基于 Stage 1 / Stage 2 / Stage 2 并行 test_spec 的"主要读取路径"整理节 6 的自然语言总结
- 将命中追踪整理为节 6 的自然语言总结写入 `{feature_dir}/archive-report.md`
- 默认执行 MCP `mcp__front_feishu__feishu_create_doc` 上传飞书（无额外确认门）
- git commit 归档产物
- 输出归档汇总（含代码采纳率、3 条阶段知识库命中率等扩展核心指标）

必须等待 archive-report-agent 完成并返回后，才能启动 Step 4-5

### 落盘（归档完成，Step 4-4 后立即写入）

```bash
python3 -c "
import re, datetime, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
tokens = '{session_token_count}'
# 归档阶段表行
c = re.sub(
    r'(\| Step 4-3~4-4 归档报告 \| )⏳ 待执行( \| archive-report\.md \| )—( \| )—( \|)',
    rf'\g<1>✅ 已完成\2{now}\3{tokens}k\4',
    c
)
# 变量传递区（原有字段）
for k, v in [('archive_status','completed'),('archive_code_ref','{archive_code_ref}'),('archive_report_path','{feature_dir}/archive-report.md')]:
    pattern = rf'(\| {re.escape(k)} +\| ).*?( \|)'
    if re.search(pattern, c):
        c = re.sub(pattern, rf'\g<1>{v}\2', c)
    else:
        c += f'\n| {k} | {v} |'
c = c.replace('- [ ] step4-3-4-archive-report', '- [x] step4-3-4-archive-report')
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Step 4-3~4-4 state written')
"
```

---

## Step 4-4.5: 重建 GitNexus 索引（conditional）

**触发条件**：同时满足以下两个条件：
1. `post_ai_commits=true`（即 `archive_code_ref != ai_commit_hash`，本次归档包含新代码提交）
2. `.mrd-to-code-config.json` 中 `plugin_availability.gitnexus.indexed=true`

任一条件不满足，直接跳过，不得阻塞 Step 4-5。

**执行**：

```bash
npx gitnexus analyze
```

等待命令完成（同步阻塞），确保后续 impact 分析使用最新索引。

### 落盘

无需写入 execution-state.md（步骤无独立阶段行），执行完成后直接进入 Step 4-5。

---

## Step 4-5: 提取学习本能（后台非阻塞）

> 非阻塞：在 Step 4-4 完成后后台启动，不影响归档完成时机的展示。

三源输入：
- P0 `{feature_dir}/archive-report.md`（AI 采纳率，必须已生成）
- P1 `{feature_dir}/code-review.md`（L0 BLOCK 反例，可选）
- P2 `{feature_dir}/execution-state.md`（阶段结论，可选）

双向提炼：成功模式（project/task instinct）+ 失败反例（anti-pattern/refine-instinct）

双轨写入：
- [轨道 A] `.claude/projects/{project_hash}/instincts/{feature_name}-{type}-{N}.md`
- [轨道 B] `.claude/projects/{project_hash}/MEMORY.md`（追加）

### 落盘（spawn 后立即写入，不等待后台 agent 返回）

```bash
python3 -c "
import re, datetime, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
c = re.sub(
    r'(\| Step 4-5 本能提取 \| )⏳ 待执行( \| instincts/ \| )—( \| )—( \|)',
    rf'\g<1>🔄 后台运行\2{now}\3—\4',
    c
)
c = c.replace('- [ ] step4-5-instinct-extract', '- [x] step4-5-instinct-extract')
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Step 4-5 state written')
"
```
