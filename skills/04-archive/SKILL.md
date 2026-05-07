---
name: archive
version: v3.1.1
description: 归档需求。顺序调度归档链路：有 OpenSpec 时先归档 OpenSpec；归档前先锁定当前分支最新代码快照作为事实基线；随后更新三类知识库（应用+业务+测试）→ 生成需求跟踪报告（本地文件仍为 `archive-report.md`）+ 默认上传飞书 + 归档 commit → 提取学习本能（后台，非阻塞）。需求完成后即可触发，无需等待合入主分支。当用户说"归档"、"归档需求"、"生成需求报告"时触发。
user-invocable: true
---

# 归档（Skill）

> **Skill 定义「按什么标准做」**；具体执行由专职 Agent 完成。
>
> 本 Skill 是**入口 5**，需求完成后即可手动触发。
>
> ⚠️ **归档报告上传规则**：`{feature_dir}/archive-report.md` 生成后默认立即上传飞书，**不再单独弹出"是否上传"确认门**。
> ⚠️ **归档报告命名规则**：报告标题、正文、飞书文档标题中**禁止**出现"草稿""草案""初稿"等表述。
> ⚠️ **需求跟踪报告规则**：Stage 4 必须生成一份**已填值的正式需求跟踪报告**；禁止保留 `{score}`、`{prd_coverage}`、`TODO` 等未替换占位符。
> ⚠️ **飞书上传空间规则**：优先上传到根目录 `https://your-domain.feishu.cn/wiki/JoYLweMjQi0haGkrxE3cYbAnnFb` 下的当前迭代子目录；子目录不存在时创建；创建失败时回退到根目录。禁止上传到其他临时空间。
> ⚠️ **归档代码基线规则**：归档知识库与归档报告引用的代码事实必须以当前分支最新提交 `HEAD` 为准。禁止仅按 `ai_commit_hash` 时刻的旧代码归档。
> ⚠️ **AI commit 可解析性规则**：`ai_commit_hash` 不可解析时，归档报告节4必须写 `—` 并注明原因；**禁止**回退为 `0%`。

> 配置文件自愈 → `assets/archive-steps.md` | 验证检查 + 质量标准 → `assets/archive-validation-checks.md`

---

## 协同模型

> ⚠️ **每个 Step 均为严格阻塞执行**（Step 4-5 后台非阻塞除外）。

```
用户："归档"
   │
   └─ [顺序执行]
         ├─ Step 4-init:  初始化归档阶段表（execution-state.md 追加）
         ├─ Step 4-0.5:   锁定归档代码快照（⚠️ 最先执行，不得跳过）
         ├─ Step 4-1:     OpenSpec 归档（conditional，无 OpenSpec 时跳过）
         ├─ Step 4-1.5:   autoresearch:predict（l4_autoresearch=available 时执行，否则跳过）
         │                 扫描 ai_commit_hash→HEAD diff，识别新增/变更接口列表
         │                 输出变更接口列表，作为 Step 4-2 kb-update 的精准输入
         ├─ Step 4-2:     知识库更新（⚠️ 不得跳过）
         ├─ Step 4-3~4-4: 生成归档报告 + 上传飞书 + 归档 commit
         ├─ Step 4-4.5:   重建 GitNexus 索引（conditional，post_ai_commits=true 且 gitnexus.indexed=true 时执行，否则跳过）
         │                 执行 `npx gitnexus analyze`，刷新代码符号图谱
         └─ Step 4-5:     提取学习本能（后台非阻塞）
                           - instinct-extract（原有）
                           - /continuous-learning-v2（l4_continuous_learning_v2=available 时追加执行）
```

> 详细执行流程与落盘脚本 → `assets/archive-steps.md`
> 知识库更新必填项 → `assets/kb-update-checklist.md`
> 需求跟踪报告 6 节结构 → `assets/report-structure.md`
> Step 4-5 instinct-extract 详情 → `assets/instinct-extract-steps.md`

---

## 输入参数

| 参数               | 必须  | 说明                                    |
| ---------------- | --- | ------------------------------------- |
| `ai_commit_hash` | 是   | Stage 3 代码生成的 git commit hash         |
| `feature_dir`    | 是   | 需求本地目录                                |
| `change_name`    | 否   | OpenSpec 变更名称；仅在本次需求实际生成 OpenSpec 时必填 |
| `kb_local_path`  | 是   | 应用知识库路径                               |

> ⚠️ **归档代码输入口径**：`ai_commit_hash` 用于识别 AI 生成版本及计算采纳率；`archive_code_ref` 运行时通过 `git rev-parse HEAD` 动态锁定，不由用户手填。

---

## 产出

| 产出         | 位置                                     |
| ---------- | -------------------------------------- |
| 需求跟踪报告（本地） | `{feature_dir}/archive-report.md`      |
| 需求跟踪报告（飞书） | 飞书迭代 Wiki 目录下                          |
| 应用知识库更新    | `{kb_local_path}/` 各分层文档 + `KB_INDEX.md` |
| 归档 commit  | `archive_commit_hash`                  |
| Learnings 更新 | `{kb_local_path}/learnings.jsonl`（若有新学习） |

---

> 质量标准与验证检查 → `assets/archive-validation-checks.md`

---

## 资产文件

详见 `assets/` 目录：`archive-steps.md`、`kb-update-checklist.md`、`report-structure.md`、`instinct-extract-steps.md`、`archive-validation-checks.md`

---

## Beads 任务追踪集成

> 当 `plugin_availability.beads.installed=true` 时启用，否则静默跳过。

### 归档完成关闭 issue

```bash
$BD_BIN list --status open
$BD_BIN close <issue-id>   # 对每个 open issue
```

### 持久记忆写入

```bash
$BD_BIN update <需求主issue-id> --notes '{"archive_path":"req/foo/archive-report.md","prd_review_preference":"飞书确认版","test_injection_mode":"手动构造+ReflectionTestUtils"}'
```

### 降级策略

Beads 不可用时，仅更新 `execution-state.md` 归档状态，不影响归档流程。

---

## 归档时知识库更新

### 触发条件（满足任一即更新）

1. 本次迭代涉及核心实体变更（新增/删除枚举、实体）
2. 本次迭代涉及核心流程变更（新增/删除 Handler、Consumer）
3. 用户显式要求更新知识库

### 执行方式

调用 `kb-update-agent` 执行增量更新：

```bash
# Task prompt（仅传路径，禁止内联内容）
project_root={工程根}
mode=patch
kb_output_path={kb_local_path}
change_summary={变更摘要，≤100字符}
```

### autoresearch 预扫描（l4_autoresearch=available 时执行）

在 kb-update-agent 启动前，执行 `/autoresearch:predict` 增量识别本次迭代变更的接口：

- 扫描 `ai_commit_hash` 到 `HEAD` 之间的 diff，识别新增/变更接口
- 将变更接口列表传入 `kb-update-agent`，指导 api-index.md 精准更新
- 替代手工对比 api-index.md 的静态检查，减少遗漏

> 当 `l4_autoresearch=unavailable` 时跳过此步，kb-update-agent 自行扫描变更。

### 产出

- 更新 `KB_INDEX.md`（重新生成索引）
- 更新受影响的分层文档（01~06_*.md）
- 写入 `KB_FRESHNESS.md` 标记

### Learnings 记录

归档完成后，从 `archive-report.md` + `code-review` 结果中提取学习：

```bash
python3 scripts/learnings-log.py --skill archive --type pattern --key "xxx" --insight "xxx" --confidence 7
```

记录时机：
- 发现可复用的代码模式 → `type=pattern`
- 发现需要避免的坑点 → `type=pitfall`
- 发现架构决策依据 → `type=architecture`
