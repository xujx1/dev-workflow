# 02-implementation-plan — 归档依赖 & 恢复规则

> 由 `SKILL.md` 按需 Read。

---

## 归档依赖说明

> Stage 4 归档时，`archive-report-agent` 需要从 `execution-state.md` 读取：
> - `prd_feishu_url`：用于归档报告中的 PRD 链接
> - `tech_feishu_url`：用于归档报告中的技术方案链接
>
> 若飞书 URL 未落盘，归档报告将缺失关键产物链接，影响需求追溯。

---

## 恢复字段

- `mode=full`：由本 Skill 技术方案落盘时写入
- `mode=tech-only`：跳过本 Skill 时，由 `03-code-gen-tdd` Step T 负责写入

---

## 格式规范参考

详见 `docs/state-protocol.md` 第 99-120 行。以下为本 Skill 必须落盘的最低要求：

| 字段 | 写入时机 | 写入值示例 |
|------|---------|----------|
| `prd_local_path` | Stage 1 完成后 | `req/xxx/prd/prd.md` |
| `prd_feishu_url` | Stage 1 上传飞书后 | 飞书文档 URL |
| `tech_local_path` | Stage 2 完成后 | `req/xxx/tech-design/tech-design.md` |
| `tech_feishu_url` | Stage 2 上传飞书后 | 飞书文档 URL |
| `tech_input_version` | Stage 2 完成后 | `feishu-confirmed` / `local-confirmed` / `local-draft` |
| `last_completed_stage` | 每阶段完成后 | `stage1-prd` / `stage2-tech-design` |
| `next_stage` | 每阶段完成后 | `stage2-tech-design` / `none` |

---

## 多域归档依赖说明（is_multi_domain=true）

> 多域时，`archive-report-agent` 需要从**各 app 各自**的 `execution-state.md` 独立读取：

- `prd_feishu_url`：同域各 app 值相同（均指向域级 PRD 飞书文档）；跨域则各域不同
- `tech_feishu_url`：各 app 独立（每个 app 有自己的技术方案飞书文档）
- `domain_config`：记录本 app 所属域信息，供归档报告标注域归属

归档约束：
- 归档报告需按 app 维度独立生成，不跨 app 合并
- 每个 app 的归档产出存放于 `{app}/req/{需求名}/` 目录下
- archive-report-agent 扫描入口：遍历 apps.json 中的 `feature_abs_path` 列表

多域必须落盘的最低字段（每个 app 的 execution-state.md）：

| 字段 | 写入时机 | 写入值示例 |
|------|---------|----------|
| `domain_config` | Stage 0.5-domain 确认后 | 域名 + 所属 apps JSON |
| `prd_local_path` | Phase 2-A PRD 落盘后 | `{feature_abs_path}/prd.md` |
| `prd_feishu_url` | Phase 2-A 上传飞书后 | 域级飞书文档 URL（同域共用） |
| `tech_local_path` | Phase 2-B 落盘后 | `{feature_abs_path}/tech-design.md` |
| `tech_feishu_url` | Phase 2-B 上传飞书后 | 应用级独立飞书文档 URL |
| `last_completed_stage` | 每阶段完成后 | `stage2-tech-design` |
| `next_stage` | 每阶段完成后 | `none` |

---

## Checklist 恢复规则

> 当 Skill 被中途重启或 context compaction 后重新进入时，通过读取 `execution-state.md` 中的 `## Execution Checklist` 节来决定从哪个步骤恢复。

### 场景一：正常恢复（Checklist 节存在）

```bash
python3 - <<'EOF'
import re, sys

state_path = "{feature_dir}/execution-state.md"

with open(state_path) as f:
    content = f.read()

match = re.search(r'## Execution Checklist\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
if not match:
    print("MISSING")
    sys.exit(1)

checked   = re.findall(r'- \[x\] (.+)', match.group(1))
unchecked = re.findall(r'- \[ \] (.+)', match.group(1))

print("CHECKED:"   + ",".join(checked))
print("UNCHECKED:" + ",".join(unchecked))
EOF
```

- 已勾选（`[x]`）的步骤 → **跳过，不重复执行**
- 未勾选（`[ ]`）的步骤 → **重新执行对应 Step/Phase**
- 所有项均已勾选 → 直接进入确认门

### 场景二：Checklist 节缺失

- `## Execution Checklist` 节不存在（返回 `MISSING`）→ 视为全未完成
- **动作**：回退到 **Step 0.5**，重新初始化状态文件骨架（覆盖写入 Checklist 节）
- ⚠️ 不删除已有状态字段（`prd_feishu_url` 等），仅补全缺失的 Checklist 节

### 场景三：多域部分完成恢复（is_multi_domain=true）

```bash
python3 - <<'EOF'
import re, sys, json

# apps 列表从 execution-state.md 或 apps.json 中读取
apps_json_path = "{feature_dir}/apps.json"
with open(apps_json_path) as f:
    apps = json.load(f)   # [{"app_id": "xxx", "feature_abs_path": "..."}]

incomplete_prd  = []
incomplete_tech = []

for app in apps:
    app_id    = app["app_id"]
    state_path = app["feature_abs_path"] + "/execution-state.md"
    try:
        with open(state_path) as f:
            content = f.read()
        if f"- [ ] step-2a-prd-{app_id}" in content:
            incomplete_prd.append(app_id)
        if f"- [ ] step-2b-tech-{app_id}" in content:
            incomplete_tech.append(app_id)
    except FileNotFoundError:
        incomplete_prd.append(app_id)
        incomplete_tech.append(app_id)

if incomplete_prd:
    print("INCOMPLETE_PRD:"  + ",".join(incomplete_prd))
if incomplete_tech:
    print("INCOMPLETE_TECH:" + ",".join(incomplete_tech))
if not incomplete_prd and not incomplete_tech:
    print("ALL_COMPLETE")
EOF
```

- `INCOMPLETE_PRD: [app_id, ...]` → 仅对这些 app 重新执行 **Phase 2-A**
- `INCOMPLETE_TECH: [app_id, ...]` → 仅对这些 app 重新执行 **Phase 2-B**
- `ALL_COMPLETE` → 直接进入确认门（多域格式）
