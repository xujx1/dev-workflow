# execution-state.md 合并脚本

> 由 `03-code-gen-tdd` Skill 的 Step T / Step 1 调用，用于初始化或追加 `execution-state.md`。

## 脚本

```bash
python3 -c "
import pathlib, datetime, re
f = '{feature_dir}/execution-state.md'
p = pathlib.Path(f)
feature_dir = '{feature_dir}'
feature_name = '{feature_name}'
mode = '{mode}'
prd_local_path = '{prd_local_path}'
tech_local_path = '{tech_local_path}'
test_mode = '{test_mode}'
openspec_change_path = '{openspec_change_path}'
kb_local_path = '{kb_local_path}'

now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

if p.exists():
    c = p.read_text(encoding='utf-8')
    changed = False

    # ── 1. 追加 code-gen-tdd 版本标记（仅首次）──────────────────
    if 'code-gen-tdd' not in c:
        c = re.sub(
            r'(> 技能版本：.*)',
            r'\1\n> 技能版本：code-gen-tdd v3.1.2（追加）\n> code-gen-tdd 启动：' + now,
            c, count=1
        )
        changed = True

    # ── 2. 追加 03 所需上下文字段（若上下文节已存在则追加到节末尾）──
    context_fields_needed = []
    if 'prd_local_path' not in c and prd_local_path:
        context_fields_needed.append(f'| prd_local_path | {prd_local_path} |')
    if 'tech_local_path' not in c and tech_local_path:
        context_fields_needed.append(f'| tech_local_path | {tech_local_path} |')
    if 'test_mode' not in c:
        context_fields_needed.append(f'| test_mode | {test_mode} |')
    if 'openspec_change_path' not in c:
        context_fields_needed.append(f'| openspec_change_path | {openspec_change_path or \"—\"} |')
    if context_fields_needed:
        # 找到上下文表的末尾（最后一个 | 行之后、第一个 --- 之前）并插入
        ctx_block = '\n'.join(context_fields_needed)
        # 在 ## 上下文 节的表格末尾（遇到空行或 --- 前）插入
        c = re.sub(
            r'(## 上下文\b.*?\n(?:\|.*\n)+)',
            lambda m: m.group(0).rstrip() + '\n' + ctx_block + '\n',
            c, count=1, flags=re.DOTALL
        )
        changed = True

    # ── 3. 追加 Phase 状态节（若不存在）────────────────────────────
    if '## Phase 状态' not in c:
        phase_section = '''
---

## Phase 状态

| Phase | 状态 | 产出路径 | 完成时间 | 消耗Token |
|------|------|---------|---------|---------|
| Phase 0 环境预检 | ⏳ 待执行 | — | — | — |
| Phase 1 测试规格 | ⏳ 待执行 | — | — | — |
| Phase 1.5 OpenSpec初始化 | ⏳ 条件执行 | — | — | — |
| Phase 2 实现代码 | ⏳ 待执行 | — | — | — |
| Phase 3 Code Review | ⏳ 待执行 | — | — | — |
| Phase 4 测试代码生成 | ⏳ 待执行 | — | — | — |
| Phase 5 测试执行与覆盖率 | ⏳ 待执行 | — | — | — |
| Phase 6 汇总结果 | ⏳ 待执行 | — | — | — |
'''
        c = c.rstrip() + phase_section
        changed = True

    # ── 4a. 若过程数据节已存在但缺少 dispatch_params 字段，则追加────
    if '## 过程数据' in c and 'dispatch_params' not in c:
        c = re.sub(
            r'(## 过程数据\b.*?\n(?:\|.*\n)+)',
            lambda m: m.group(0).rstrip() + '\n| dispatch_params | — |\n',
            c, count=1, flags=re.DOTALL
        )
        changed = True

    # ── 4. 追加过程数据节（若不存在）────────────────────────────────
    if '## 过程数据' not in c:
        proc_section = '''
---

## 过程数据

| 字段 | 值 |
|------|----|
| last_completed_phase | phase0 |
| next_phase | phase1 |
| awaiting_user_confirmation_for | none |
| phase_gate_status | — |
| phase5_dod_met | false |
| test_retry_count | 0 |
| coverage_retry_count | 0 |
| review_result | — |
| test_pass_rate | — |
| coverage_rate | — |
| skill_completion_status | in_progress |
| dispatch_params | — |
'''
        c = c.rstrip() + proc_section
        changed = True

    # ── 5. 追加 Phase Checklist 条目（若 Execution Checklist 节已存在则追加；否则新建）──
    phase_checklist_items = '''- [ ] phase0-env-check
- [ ] phase1-test-spec
- [ ] phase1_5-openspec-init
- [ ] phase2-impl-code
- [ ] phase3-code-review
- [ ] phase4-test-code
- [ ] phase5-test-run
- [ ] phase6-summary'''
    if 'phase0-env-check' not in c:
        if '## Execution Checklist' in c:
            # 追加到已有节末尾
            c = re.sub(
                r'(## Execution Checklist\b.*?\n)',
                r'\1\n' + phase_checklist_items + '\n',
                c, count=1, flags=re.DOTALL
            )
        else:
            c = c.rstrip() + '''

---

## Execution Checklist

> **规则**：每个 Phase 完成后 orchestrator 立即更新对应条目。

''' + phase_checklist_items + '\n'
        changed = True

    if changed:
        p.write_text(c, encoding='utf-8')
        print('execution-state.md merged: Phase sections appended, implementation-plan data preserved')
    else:
        print('Phase sections already exist, skipped')

else:
    # 文件不存在：全量创建
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(f'''# {feature_name} — 执行状态

> 最后更新：{now}
> 技能版本：code-gen-tdd v3.1.2

---

## 上下文

| 参数 | 值 |
|------|----|
| feature_dir | {feature_dir} |
| prd_local_path | {prd_local_path} |
| tech_local_path | {tech_local_path} |
| kb_local_path | {kb_local_path} |
| mode | {mode} |
| test_mode | {test_mode} |
| openspec_change_path | {openspec_change_path or \"—\"} |

---

## Phase 状态

| Phase | 状态 | 产出路径 | 完成时间 | 消耗Token |
|------|------|---------|---------|---------|
| Phase 0 环境预检 | ⏳ 待执行 | — | — | — |
| Phase 1 测试规格 | ⏳ 待执行 | — | — | — |
| Phase 1.5 OpenSpec初始化 | ⏳ 条件执行 | — | — | — |
| Phase 2 实现代码 | ⏳ 待执行 | — | — | — |
| Phase 3 Code Review | ⏳ 待执行 | — | — | — |
| Phase 4 测试代码生成 | ⏳ 待执行 | — | — | — |
| Phase 5 测试执行与覆盖率 | ⏳ 待执行 | — | — | — |
| Phase 6 汇总结果 | ⏳ 待执行 | — | — | — |

---

## 过程数据

| 字段 | 值 |
|------|----|
| last_completed_phase | none |
| next_phase | phase0 |
| awaiting_user_confirmation_for | none |
| phase_gate_status | — |
| phase5_dod_met | false |
| test_retry_count | 0 |
| coverage_retry_count | 0 |
| review_result | — |
| test_pass_rate | — |
| coverage_rate | — |
| skill_completion_status | in_progress |
| dispatch_params | — |

---

## Execution Checklist

> **规则**：每个 Phase 完成后 orchestrator 立即更新对应条目。

- [ ] phase0-env-check
- [ ] phase1-test-spec
- [ ] phase1_5-openspec-init
- [ ] phase2-impl-code
- [ ] phase3-code-review
- [ ] phase4-test-code
- [ ] phase5-test-run
- [ ] phase6-summary
''', encoding='utf-8')
    print('execution-state.md created')
"
```

## 规则

- **文件已存在（来自 `02-implementation-plan`）**：
  - 保留原有 `## 上下文`、`## 阶段状态`（Stage 行）、`## 变量传递`、`## Execution Checklist` 全部内容不删除
  - 追加 `code-gen-tdd` 版本标记到文件头
  - 追加 `03` 需要的上下文字段（`prd_local_path`、`tech_local_path`、`test_mode`、`openspec_change_path`）到上下文表末尾
  - 追加 `## Phase 状态` 节（Phase 0~6）
  - 追加 `## 过程数据` 节
  - 追加 `phase0-env-check` ~ `phase6-summary` checklist 条目
- **文件不存在**：全量创建（含所有节）
- `mode=tech-only` 时 `prd_local_path` 传 `N/A`
