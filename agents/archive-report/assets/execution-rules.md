# archive-report-agent 执行规则详情

> 本文件由 `archive-report-agent.md` 骨架按需 Read。


## Step 4-3-A：确定飞书上传目标

> ⚠️ 飞书上传为强制步骤，不得跳过。

**迭代号三级查找链（按顺序，成功即停止）**：

```
Level 1：读 mrd-clarified.md → 查找 `> 迭代号：` 行
Level 2：查询迭代追踪表 feishu_get_doc_content(config.feishu.iteration_table_url)
         默认：https://your-domain.feishu.cn/wiki/DthEwdPPHipUF8k4iLucriYonuw
Level 3：阻塞询问用户（禁止跳过）
```

**上传目录解析（三级，按顺序，成功即停止）**：

```
Level 1：config.feishu.execution_space_url 有值 → 直接使用（项目级硬配置优先）

Level 2：从 wiki 主目录中按 iteration_no 匹配迭代子页面 URL
  - feishu_get_doc_content(config.feishu.wiki_root_url)
    缺省：https://your-domain.feishu.cn/wiki/JoYLweMjQi0haGkrxE3cYbAnnFb
  - 在返回内容中搜索包含 "{iteration_no}" 的飞书 wiki 链接（格式如 /wiki/Xxxxx）
  - 找到 → resolved_parent_url = 该完整 URL（https://your-domain.feishu.cn/wiki/Xxxxx）

Level 3：主目录中未找到 iteration_no 对应条目（迭代子页面尚未创建）
  → 自动创建：
    feishu_create_doc(
      title: "{iteration_no} 迭代",
      content: "# {iteration_no} 迭代\n\n本页自动创建，用于归档迭代需求报告。",
      parentUrl: config.feishu.wiki_root_url（缺省 https://your-domain.feishu.cn/wiki/JoYLweMjQi0haGkrxE3cYbAnnFb）
    )
  → resolved_parent_url = 新创建页面的返回 URL
  → 在输出汇总中注明：「已自动创建迭代目录：{url}」
```

## Step 4-3-B：生成需求跟踪报告

> 代码事实口径：以 `archive_code_ref` 对应代码为准；`ai_commit_hash` 仅用于采纳率对比。
> commit 基线校验：生成节 4 前必须 `git rev-parse --verify` 校验两个 hash，任一不可解析则写 `AI 代码采纳率 = —`。

并行读取：`{feature_dir}/mrd-clarified.md`、`{feature_dir}/prd.md`、`{feature_dir}/tech-design.md`、`assets/archive-report-template.md`

报告结构（5 个主体节）：
- **节 1**：MRD 标准度（背景/目标/用户/场景/验收/风险 6 维度）
- **节 2**：AI PRD 功能覆盖度（PRD Story 数 vs MRD 需求点）
- **节 3**：AI 技术方案覆盖度（技术方案 vs PRD Story 覆盖率）
- **节 4**：AI 代码采纳率（ai_commit_hash 基线 vs archive_code_ref 最终快照）
- **节 5**：测试报告摘要（spawn coverage-report-agent 获取覆盖率）

**节 4 计算**：
```bash
git diff {ai_commit_hash}^ {ai_commit_hash} --stat  # AI 初版基线
git diff {ai_commit_hash} {archive_code_ref} --stat  # 归档前追加修改
```

报告头部必须写入：
- `OpenSpec 变更：{openspec_archive_status}`
- `AI 生成 commit：{ai_commit_hash}`
- `归档代码快照：{archive_code_ref}`

⚠️ 禁止残留占位符（`{score}`、`{prd_coverage}` 等），违反则视为生成失败。

## Step 4-3-B.5：生成命中追踪总结（节 6）

**读取来源**：
1. `{feature_dir}/execution-state.md` 中"过程数据"小节
2. 禁止：生成或依赖 `hit-tracking-report.md`（已废弃）

**节 6 格式**：
```markdown
## 节 6：命中追踪

### 按阶段阅读轨迹
- PRD 生成：主要依赖知识资产（应用知识库/业务知识库/代码入口）
- 技术方案：主要参考（PRD/应用知识库/核心代码）
- 测试规格：主要参考（技术方案/测试知识库/业务场景）
- 代码生成/Review：主要参考（技术方案/知识库/核心链路代码）
- 测试代码：主要参考（test_spec/测试规则/调用链代码）

### 重点命中资产
- 应用知识库：3-5 个关键文档
- 业务知识库：2-4 个关键文档
- 测试知识库：2-4 个关键文档
- 关键代码：3-5 个核心类/文件

### 阶段知识库命中率
- PRD 生成：{prd_kb_hit_rate}
- 技术方案：{tech_kb_hit_rate}
- 测试用例：{test_spec_kb_hit_rate}

### 结论（2-4 句）
```

节 6 完成后才能进入 Step 4-3-C。

## Step 4-3-C：上传飞书（强制）

**前置校验（parentUrl 非空门禁）**：

```
若 resolved_parent_url 为空 / null / undefined：
  → 阻塞，输出：
    ❌ 飞书上传中止：parentUrl 未解析成功。
       请检查 config.feishu.execution_space_url / wiki_root_url 配置后重试。
  → 禁止继续调用 feishu_create_doc
  → 禁止进入 Step 4-3.5
```

通过校验后方可调用：

```
feishu_create_doc(
  title: "{需求名称} 需求跟踪报告（迭代{iteration_no}）",
  content: archive-report.md 内容,
  parentUrl: {resolved_parent_url}   ← 必须为非空字符串
)
```

> 标题禁止含"草稿""草案""Draft"等表述。
> 上传前必须校验无残留占位符。
> 失败时重试一次；重试仍失败则阻塞，禁止直接进入 git commit。

## Step 4-3.5：git commit 归档产物

```bash
git add {kb_local_path}/
git add {feature_dir}/archive-report.md
git commit -m "chore: 归档 {需求名称}（迭代{iteration_no}）

- 知识库已更新：{kb_updated_files}
- 需求跟踪报告：{feature_dir}/archive-report.md
- 飞书报告：{feishu_report_url}"
```

## Step 4-4：输出归档汇总格式

```
## 归档完成

核心指标：MRD标准度/PRD覆盖度/技术方案覆盖度/代码采纳率/各阶段命中率/测试行覆盖率
产出物：OpenSpec归档状态/知识库更新情况/本地报告/飞书报告/归档commit
```
