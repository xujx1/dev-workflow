# 02-implementation-plan — 路径门禁

> 由 `SKILL.md` 按需 Read。

---

## 基本规则

- orchestrator 在进入任何 Agent 前，必须先解析出可用的 `feature_dir`
- PRD 唯一合法本地路径：`{feature_dir}/prd.md`（AI 生成后用户可直接在本地编辑）
- 技术方案唯一合法本地路径：`{feature_dir}/tech-design.md`（AI 生成后用户可直接在本地编辑）
- **禁止**写 `prd-draft.md`、`prd-confirmed.md`、`tech-design-draft.md`、`tech-design-confirmed.md` 等中间文件
- 飞书版本通过 URL 标识（记录在 `execution-state.md`），归档时直接从飞书 URL 拉取，不落盘本地

---

## 多域追加规则（is_multi_domain=true 时）

- `{feature_dir}` = `{app 项目根路径}/req/{需求名}/`，每个 app 均有独立的 feature_dir，路径中不含 domain 层级
- prd.md 由所属域 prd-generator-agent 写入，各 app 均写相同内容
- 禁止在 feature_dir 之外写入任何文档
- 禁止使用 `prd/{domain}/prd.md` 层级结构（废弃）
