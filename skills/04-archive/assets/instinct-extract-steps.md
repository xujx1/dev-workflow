# 04-archive — Step 4-5 instinct-extract 详情

> 由 `SKILL.md` 按需 Read。

---

## 概述

基于 ECC `continuous-learning-v2` 的 instinct 模型，在归档时自动沉淀经验。**非阻塞**：在 Step 4-4 完成后后台启动，不影响归档完成时机的展示。

---

## 触发条件

`{feature_dir}/archive-report.md` 中「AI 代码采纳率」节已生成，提供本次被接受/修改/拒绝的模式数据。

---

## 调度方式

- 调度 Agent：`agents/instinct-extract/instinct-extract-agent.md`
- 建议方式：后台非阻塞执行（`run_in_background: true`）
- 建议模型：低成本、快速模型
- 传入参数：
  - `feature_dir`
  - `feature_name`
  - `ai_commit_hash`
  - `project_hash`（若上层已计算）

---

## Agent 职责

- 读取 `{feature_dir}/archive-report.md` 的「节4：AI 代码采纳率」
- 分析本次需求中被接受、修改、拒绝的代码模式
- 提取 2~5 条 project-scoped atomic instinct
- 将每条 instinct 写入 `.claude/projects/{project_hash}/instincts/{feature_name}-{N}.md`
- 返回提取数量、置信度分布与写入文件列表

---

## 本能管理

- 提取后可用 `/instinct-status` 查看积累的本能
- 高置信度本能（>0.7）积累 3+ 次后，考虑用 `/evolve` 升级为项目规则
- 跨需求反复出现的本能可用 `/promote` 升级为全局本能
