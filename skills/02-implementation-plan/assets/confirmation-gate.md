# 02-implementation-plan — 确认门规范

> 由 `SKILL.md` 按需 Read。

---

## Checklist 完整性验证（确认门前强制执行）

在展示确认门之前，**必须先执行以下验证**：

```bash
python3 - <<'EOF'
import re, sys

state_path = "{feature_dir}/execution-state.md"

with open(state_path) as f:
    content = f.read()

# 找到 Execution Checklist 节
match = re.search(r'## Execution Checklist\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
if not match:
    print("MISSING: execution-state.md 中缺少 ## Execution Checklist 节")
    sys.exit(1)

checklist_block = match.group(1)
unchecked = re.findall(r'- \[ \] (.+)', checklist_block)

if unchecked:
    print("CHECKLIST_INCOMPLETE:")
    for item in unchecked:
        print(f"  - {item}")
    sys.exit(1)

print("CHECKLIST_OK")
EOF
```

- 输出 `CHECKLIST_OK` → 继续展示确认门
- 输出 `CHECKLIST_INCOMPLETE` → **阻塞**，列出未勾选项，提示补充完成后重新运行
- 输出 `MISSING` → **阻塞**，提示 execution-state.md 结构异常，需检查 Step 0.5 是否正常执行

---

## 确认门输出格式

```
## Stage 完成：PRD + 技术方案均已生成并上传飞书

PRD（已上传飞书）：{prd_feishu_url}
  └─ 正文（产品可读）：背景 / 目标 / 角色 / 功能变更 / AC / 业务边界

技术方案（已上传飞书）：{tech_feishu_url}
  └─ 正文：技术改造点 / 接口 / DB / 时序图 / 工时预估
  └─ 附录I：需求拆解（Story + 任务 + 工时）
  └─ 附录II：变更影响分析（GitNexus）
  └─ 附录III：场景扩展分析（技术视角）
  └─ 附录IV：多视角架构分析（autoresearch）

首版预估人日：{N}（AI 首版，可继续修改）
技术方案摘要：（改动模块 / 核心逻辑变更 / 灰度方案 / 稳定性措施，3-5 条）
需求拆解摘要：（Story 数量 / 总工时人日 / 风险项，见附录I）

---
回复"符合"或"继续" → 结束本阶段
回复"工时改为 X 人日" → 更新估算附录后重新展示
回复具体修改意见 → 修改后重新展示
```

## 用户响应处理

| 用户回复 | 处理方式 |
|---------|---------|
| "符合" / "继续" | 结束本阶段 |
| "工时改为 X 人日" | 更新 `tech-design.md` 估算附录后重新展示确认门 |
| 具体修改意见 | 修改对应文档后重新展示确认门 |

---

## 多域确认门输出格式（is_multi_domain=true 时替换）

```
## Stage 完成：{N} 份 PRD + {M} 份技术方案均已生成并上传飞书

PRD（按领域，已上传飞书，同域各 app 共用同一 URL）：
  └─ 【{域名A}】{prd_feishu_url_A}（覆盖应用：{app1}, {app2}）
  └─ 【{域名B}】{prd_feishu_url_B}（覆盖应用：{app3}, {app4}, {app5}）

技术方案（按应用，已独立上传飞书）：
  └─ {app1}：{tech_feishu_url_1}  预估 {n1} 人日
  └─ {app2}：{tech_feishu_url_2}  预估 {n2} 人日
  └─ {app3}：{tech_feishu_url_3}  预估 {n3} 人日
  └─ {app4}：{tech_feishu_url_4}  预估 {n4} 人日
  └─ {app5}：{tech_feishu_url_5}  预估 {n5} 人日

首版预估人日合计：{总N}（各应用分项见上，AI 首版，可继续修改）

---
回复"符合"或"继续" → 结束本阶段
回复"工时改为 {app} X 人日" → 更新指定 app 估算后重新展示
回复具体修改意见 → 修改后重新展示
```

## 多域用户响应处理

| 用户回复 | 处理方式 |
|---------|---------|
| "符合" / "继续" | 结束本阶段 |
| "工时改为 {app} X 人日" | 更新指定 app 的 `tech-design.md` 估算附录后重新展示 |
| 具体修改意见 | 修改指定文档后重新展示 |
