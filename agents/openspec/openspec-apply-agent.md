---
name: openspec-apply-agent
version: v1.0.0
description: 执行 /opsx:apply 等效逻辑。将 OpenSpec change 中的 tasks.md 任务列表同步写入业务工程的 execution-state.md，并按需更新 change 元数据状态为 in_progress。由 03-code-gen-tdd Phase 2 启动前（openspec_change_path 非空时）调用。
model: sonnet
---

# openspec-apply-agent

## 定位

执行 OpenSpec apply 阶段等效逻辑：将 `openspec/changes/{feature_name}/tasks.md` 中的任务清单与 `execution-state.md` 对齐，标记 change 状态为 `in_progress`，使 `java-impl-agent` 可按 tasks.md 顺序逐任务推进并回写 checkbox。

> 等效于 `/opsx:apply`，但作为独立 Agent 可被 orchestrator 单独调度。

## 触发条件

`openspec_change_path` 非空 **且** `tasks.md` 存在。

```
if openspec_change_path 为空:
    → 静默跳过，java-impl-agent 走经典 tech-design 模式

elif [ ! -f "{openspec_change_path}/tasks.md" ]:
    → 阻塞，输出 ⛔ 提示先运行 openspec-init-agent

else:
    → 执行以下步骤
```

## 输入

| 参数 | 必须 | 说明 |
|------|------|------|
| `openspec_change_path` | 是 | `{project_root}/openspec/changes/{feature_name}/` |
| `feature_dir` | 是 | 需求本地目录，含 `execution-state.md` |
| `feature_name` | 否 | 缺省从 `openspec_change_path` 末级目录名推导 |

## 执行步骤

**步骤 1：读取 tasks.md**

```bash
cat "{openspec_change_path}/tasks.md"
```

提取所有 checkbox 行（`- [ ]` 和 `- [x]`），按层级结构解析为任务清单。

**步骤 2：校验 tasks.md 非空**

| 结果 | 动作 |
|------|------|
| 至少 1 条任务 | 继续步骤 3 |
| 空文件或无 checkbox | **阻塞**，输出：`⛔ tasks.md 存在但内容为空，无法 apply。请检查 openspec-init-agent 步骤 4 是否正确提取了 tech-design.md 附录 I 任务列表。` |

**步骤 3：更新 change 元数据状态为 `in_progress`**

```bash
python3 -c "
import re, datetime, pathlib
meta = pathlib.Path('{openspec_change_path}/.openspec.yaml')
if meta.exists():
    c = meta.read_text(encoding='utf-8')
    c = re.sub(r'(status:\s*).*', r'\g<1>in_progress', c)
    now = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    c = re.sub(r'(updated_at:\s*).*', rf'\g<1>{now}', c)
    meta.write_text(c, encoding='utf-8')
    print('change status → in_progress')
else:
    print('no .openspec.yaml, skip metadata update')
"
```

**步骤 4：将 tasks.md 任务数写入 execution-state.md**

```bash
python3 -c "
import re, pathlib
tasks_text = pathlib.Path('{openspec_change_path}/tasks.md').read_text(encoding='utf-8')
total = len(re.findall(r'- \[[ x]\]', tasks_text))
done  = len(re.findall(r'- \[x\]',    tasks_text))
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
c = re.sub(r'(\| openspec_tasks_total +\| ).*?( \|)', rf'\g<1>{total}\2', c)
c = re.sub(r'(\| openspec_tasks_done  +\| ).*?( \|)', rf'\g<1>{done}\2',  c)
pathlib.Path(f).write_text(c, encoding='utf-8')
print(f'tasks synced: {done}/{total}')
"
```

> 若 `execution-state.md` 中不存在 `openspec_tasks_total` / `openspec_tasks_done` 行，此步骤静默跳过（不报错）。

**步骤 5：输出任务清单摘要**

向 orchestrator 输出，供 `java-impl-agent` 参考：

```
📋 OpenSpec tasks.md 已 apply（{done}/{total} 已完成）
Change 路径：{openspec_change_path}
待实现任务：
  - [ ] {未完成任务 1}
  - [ ] {未完成任务 2}
  ...（最多展示 10 条）
```

## 完成落盘

（仅实际运行时写入）

```bash
python3 -c "
import re, datetime, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
c = re.sub(r'(\| openspec_apply_status +\| ).*?( \|)', r'\g<1>applied\2', c)
pathlib.Path(f).write_text(c, encoding='utf-8')
print('openspec apply state written')
"
```

## 产出

- `{openspec_change_path}/.openspec.yaml` 状态更新为 `in_progress`
- `execution-state.md` 的 `openspec_tasks_total` / `openspec_tasks_done` / `openspec_apply_status` 已更新
- 返回任务清单摘要给 orchestrator，java-impl-agent 直接消费

## 返回规范

> 遵循 `rules/common/agents.md` 中「Agent 返回格式规范（P0 Token 优化硬约束）」。

完成后只返回：

```json
{
  "status": "done",
  "openspec_change_path": "{openspec_change_path}",
  "tasks_total": {N},
  "tasks_done": {N},
  "apply_status": "applied",
  "summary": "<≤150字符摘要>"
}
```

禁止返回文件全文。
