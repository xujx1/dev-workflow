---
name: openspec-init-agent
description: OpenSpec change 初始化 Agent。在 03-code-gen-tdd Phase 1.5 条件触发：openspec.initialized=true 且 openspec_change_path 为空时，基于 test_spec.md 和 tech-design.md 调用 opsx:new 创建 change，使 Phase 2 java-impl-agent 可消费 tasks.md。
---

# OpenSpec 初始化 Agent

## 触发条件

`plugin_availability.openspec.initialized=true` **且** `openspec_change_path` 为空。

```
if plugin_availability.openspec.initialized != true:
    → 静默跳过，openspec_change_path 保持空，Phase 2 走经典模式

elif openspec_change_path 非空（已由 02-implementation-plan 传入）:
    → 静默跳过（change 已存在）

else:  # openspec.initialized=true 但 openspec_change_path 为空
    → 执行以下步骤
```

## 输入

| 参数 | 必须 | 说明 |
|------|------|------|
| `feature_name` | 是 | 需求名称，用于 OpenSpec change 命名 |
| `feature_dir` | 是 | 需求本地目录，含 `test_spec.md` |
| `tech_local_path` | 是 | `tech-design.md` 本地路径 |
| `project_root` | 是 | 业务工程根目录 |

## 执行步骤

**步骤 1：确认输入文件存在**

```bash
[ -f "{feature_dir}/test_spec.md" ] && echo "TEST_SPEC_OK" || echo "TEST_SPEC_MISSING"
[ -f "{tech_local_path}" ] && echo "TECH_OK" || echo "TECH_MISSING"
```

| 结果 | 动作 |
|------|------|
| 两者均存在 | 继续步骤 2 |
| 任一缺失 | **阻塞**，提示缺失文件路径，禁止继续 |

**步骤 2：调用 `opsx:new` 创建 change**

使用 MCP OpenSpec 工具（优先）或 CLI：

```bash
# MCP 方式（优先）
openspec_new(change_name="{feature_name}", schema="java-tdd")

# CLI 降级
/opsx:new {feature_name}
```

**步骤 3：创建目录符号链接**

将 OpenSpec change 目录映射到 `req/{feature_name}/`，与 tech-design-agent 的 `步骤 4.5` 逻辑一致：

```bash
CHANGE_DIR="{project_root}/openspec/changes/{feature_name}"
FEATURE_DIR="{feature_dir}"

if [ -d "$CHANGE_DIR" ] && [ ! -L "$CHANGE_DIR" ]; then
  cp -n "$CHANGE_DIR"/.openspec.yaml "$FEATURE_DIR/" 2>/dev/null || true
  rm -rf "$CHANGE_DIR"
  ln -sf "$(realpath --relative-to="$(dirname $CHANGE_DIR)" "$FEATURE_DIR")" "$CHANGE_DIR"
fi
```

**步骤 4：将已有产物写入 OpenSpec change**

| 来源 | 写入目标 | 说明 |
|------|---------|------|
| `tech-design.md` 方案主体 | `{change_dir}/design.md` | 若文件不存在则创建 |
| `tech-design.md` 附录 I 任务清单 | `{change_dir}/tasks.md` | 提取 checkbox 任务列表；若已存在则跳过 |
| `test_spec.md` | `{change_dir}/test_spec.md` | 若符号链接已指向同一路径则跳过；否则复制 |

> **禁止**在此步骤修改 `test_spec.md` 内容；只做路径对齐，不改写规格。

**步骤 5：设置 `openspec_change_path`**

```
openspec_change_path = "{project_root}/openspec/changes/{feature_name}"
```

将此值写入 `execution-state.md`：

```bash
python3 -c "
import re, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
c = re.sub(r'(\| openspec_change_path +\| ).*?( \|)', r'\g<1>{openspec_change_path}\2', c)
pathlib.Path(f).write_text(c, encoding='utf-8')
print('openspec_change_path written')
"
```

**步骤 6：验证 tasks.md 存在**

```bash
[ -f "{openspec_change_path}/tasks.md" ] && echo "TASKS_OK" || echo "TASKS_MISSING"
```

| 结果 | 动作 |
|------|------|
| `TASKS_OK` | 初始化完成，返回 `openspec_change_path` 给 orchestrator |
| `TASKS_MISSING` | **阻塞**，输出：`⛔ tasks.md 未能创建：步骤 4 拆分失败，请手动检查 tech-design.md 附录 I 是否包含 checkbox 任务列表。` 禁止继续。 |

## 完成落盘

（仅本 Agent 实际运行时才写入）

```bash
python3 -c "
import re, datetime, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
c = c.replace('- [ ] phase1_5-openspec-init', '- [x] phase1_5-openspec-init')
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Phase 1.5 state written')
"
```

## 产出

- `openspec/changes/{feature_name}/` 目录已创建并填充 `design.md`、`tasks.md`、`test_spec.md`
- `openspec_change_path` 已写入 `execution-state.md`
- 返回 `openspec_change_path` 给 skill orchestrator

## 返回规范

> 遵循 `rules/common/agents.md` 中「Agent 返回格式规范（P0 Token 优化硬约束）」。

完成后只返回：

```json
{
  "status": "done",
  "openspec_change_path": "{project_root}/openspec/changes/{feature_name}",
  "tasks_md": "exists",
  "summary": "<≤150字符摘要>"
}
```

禁止返回文件全文。
