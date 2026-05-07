# 内容过滤规则详情

## 输入

| 参数               | 必须  | 说明                                      |
| ---------------- | --- | --------------------------------------- |
| `mrd_local_path` | 是   | MRD 澄清版本地路径（`mrd-clarified.md`）         |
| `kb_local_path`  | 是   | 应用知识库路径（**强依赖**）                        |
| `feature_dir`    | 是   | 需求本地目录（主写路径）                            |
| `apps`           | 否   | 多域模式下该域所有应用列表，每项含 `feature_abs_path`；提供时 prd.md 需多写到所有 app |

> 硬约束：`feature_dir` 缺失或非法时必须停止，禁止落盘到项目根。

## 路径约定

- Skill 根目录查找顺序：① `$HOME/.claude/skills/dev-workflow/` ② `$HOME/.claude/plugins/dev-workflow/` ③ 向上两级推导

## 固定资源（相对 Skill 根目录）

| 资源          | 路径                                              |
| ----------- | ----------------------------------------------- |
| 执行规则详情      | `agents/prd-generator/assets/execution-rules.md` |
| PRD 模板      | `agents/prd-generator/assets/prd-template.md`    |

## Step 2：确认输入为 mrd-clarified.md

- 校验 `mrd_local_path` 指向的文件为 mrd-clarified 版本（文件名或内容头部包含 `clarified` 标记）
- 若非 clarified 版本，停止并提示先运行 mrd-clarify-agent

## Step 3：生成 PRD 草稿

按 `assets/prd-template.md` 模板生成，内容来源：
- MRD 的功能需求与业务规则
- 应用知识库的接口/架构/流程信息（事实基准）

## Step 4：自检

- PRD 所有必填章节非空
- 引用的接口/类名在知识库中可找到
- AC 可验证（不含模糊措辞如"适当""合理"）
- 无内部矛盾（同一功能在不同章节描述不一致）

## Step 5 多域多写规则

仅当调用方传入 `apps[]` 且包含多个 app 时执行：

1. 主写路径已在 Step 3 写入 `{feature_dir}/prd.md`
2. 遍历 `apps[]`，对每个 app 的 `feature_abs_path` 执行：
   - 若 `feature_abs_path == feature_dir` → 跳过（已写）
   - 否则：
     ```bash
     mkdir -p {feature_abs_path}
     cp {feature_dir}/prd.md {feature_abs_path}/prd.md
     ```
3. 落盘验证：检查所有 `feature_abs_path/prd.md` 均存在，任一缺失则重试复制

## Step 6：飞书上传 + URL 写入所有 app execution-state.md

> 多域时（`apps[]` 不为空），Step 5 完成后立即执行本步骤。

1. 调用 `feishu-doc-sync-agent` 上传 `{feature_dir}/prd.md`，获取 `prd_feishu_url`
2. 上传成功后，使用 `state-templates.md` 中「Stage 1 多域 — PRD 飞书 URL 写入」脚本，
   将 `prd_feishu_url` 写入 `apps[]` 中**所有 app** 的 `{feature_abs_path}/execution-state.md`
3. 验证：Read 每个 app 的 `execution-state.md`，确认 `prd_feishu_url` 字段非空且以 `https://your-domain.feishu.cn/` 开头；任一不符则报错

> 单域时（`apps[]` 为空），本步骤退化为：上传飞书后仅更新 `{feature_dir}/execution-state.md`（写入 `prd_feishu_url` 和 `prd_local_path`）。

## 产出

| 文件       | 路径                                        |
| -------- | ----------------------------------------- |
| PRD 草稿   | `{feature_dir}/prd.md`               |

返回给 orchestrator：`prd_local_path`（值为 `{feature_dir}/prd.md`）、`prd_feishu_url`

## 产出物元数据尾注

`prd.md` 写完后追加：

```markdown
---
> **生成元数据**
> 工具：dev-workflow v{skill_root}/VERSION | Skill: prd-gen v2.3.0
> 生成时间：{YYYY-MM-DD HH:mm}
> 知识库快照：{app-knowledge-base/CONTEXT.md 最后修改日期，若不存在则写"—"}
```

## 约束

- `prd.md` **写入后永不覆盖**（修改用 Edit）
