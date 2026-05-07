# Phase 定义 — 03-code-gen-tdd 流水线全景

> ⚠️ **全局阻塞声明**：orchestrator 在启动任何 spawn 后**必须留守等待**，直到当前 Phase 全部 Task 返回后，才能进入下一 Phase。禁止 spawn 后立即返回或中断。
>
> ⚠️ **严格顺序执行**：必须严格按 Phase 0 → 1 → 1互Review → 1确认门 → 2 → 3 → 4 → 5 → 6 顺序推进。禁止跳过任一 Phase，禁止将多个 Phase 合并为一次性生成。
>
> ⚠️ **执行节奏**：单次调用默认只执行当前待执行阶段；只有显式 `--auto` 时才允许连续推进，且最多连续 2 个 Phase。
>
> ⚠️ **Task prompt 构造约束（硬约束，违反即 "Prompt is too long"）**：spawn 任何 agent 时，Task prompt 只允许包含文件路径和小体积元数据（feature_dir, tech_local_path, prd_local_path, kb_local_path, test_spec_path, config_path 等），**禁止内联任何文件内容**（tech-design.md 正文、test_spec 正文、CONTEXT.md 内容、代码文件、diff 全文等）。所有大文本由被 spawn 的 agent 自行 Read。

## Phase 0 — 环境 + 依赖 + 表结构感知（三合一预检）

一次探测，结果写入 `execution-state.md` 供后续 Phase 复用。

### A. 环境确认
- `env_confirmed=true` → 跳过探测，直接读缓存 `maven_cmd` / `maven_settings`
- 缺失 → 执行 `mvn -v`，写入 `env_confirmed=true`、`maven_cmd`、`maven_settings`

### B. 测试依赖扫描
优先读取 `{project_root}/.mrd-to-code-config.json` 的 `env` 字段：
- `env.test_deps_junit5=true` 且 `env.test_deps_mockito=true` → 写 `test_deps_confirmed=true`，**跳过 pom.xml 扫描**（Phase 4 直接复用）
- `env.test_deps_junit5=false` → 标记 `test_deps_junit_version=4`（Phase 4 生成 JUnit4 注解代码）
- `env` 字段缺失或 `env_confirmed=false` → 回退到读目标模块 pom.xml（含父 pom），按 `rules/test/02-test-environment.md §标准测试依赖` 检测：
  - JUnit5 已声明 → `test_deps_junit5=true`；否则 → `test_deps_junit5=false`（`test_deps_junit_version=4`）
  - Mockito 已声明 → `test_deps_mockito=true`
  - 有缺失 → 立即补全 pom.xml 后写 `test_deps_confirmed=true`（**唯一时机**，Phase 4 后禁止重复追加）

**触发条件**：`env_confirmed` 或 `test_deps_confirmed` 缺失时执行；否则静默通过。Phase 0 与主流程串行。

---

## Phase 1 — 测试规格

**输入约束**：纯读需求/方案，不依赖实现代码。
- **full 模式**：MRD + PRD + 技术方案（或 OpenSpec change 产物）
- **tech-only 模式**：仅技术方案 `tech_local_path` / OpenSpec `openspec_change_path`

### Phase 1 — OpenSpec 前置检查（硬 gate，`openspec_change_path` 非空时强制执行）

若 `plugin_availability.openspec.initialized=true` 且已传入 `openspec_change_path`，启动 `tdd-test-spec-agent` **之前**必须执行：

```bash
# 检查 tasks.md 是否存在
[ -f "{openspec_change_path}/tasks.md" ] && echo "TASKS_OK" || echo "TASKS_MISSING"
```

| 检查结果 | 动作 |
|---------|------|
| `TASKS_OK` | 继续，传 `openspec_change_path` 给 `tdd-test-spec-agent` |
| `TASKS_MISSING` | **阻塞**，输出：`⛔ tasks.md 缺失：{openspec_change_path}/tasks.md 不存在。请先完成 02-implementation-plan（OpenSpec 模式）生成 tasks.md 后再执行本阶段。` 禁止继续。 |

### Phase 1 — `tdd-test-spec-agent`（必须）

- 若 `openspec_change_path` 不为空：读取 `{openspec_change_path}/design.md` + `{openspec_change_path}/tasks.md` 作为输入；输出 test_spec 到 `{openspec_change_path}/test_spec.md`；`test_spec_path` = `{openspec_change_path}/test_spec.md`
- 否则：按 `agents/tdd-test-spec/assets/test_spec_template.md` + `rules/test/04-spec-format.md` 生成 `{feature_dir}/test_spec.md`（**直接铺平到 feature_dir，禁止创建 test/ 子目录，禁止附加 _{feature_name} 后缀**）；用例「预期结果」列必须包含 `EX1` / `EX2`... 校验点编号；`test_spec_path` = `{feature_dir}/test_spec.md`

**阻塞等待**：`tdd-test-spec-agent` 返回后才能进入确认门。
**完成性校验**：进入确认门前，必须确认 `test_spec.md` 已落盘；若产物缺失，视为 Phase 1 失败，禁止继续。

### 确认门
展示 TEST_SPEC 摘要，落盘 `awaiting_user_confirmation_for=phase2`、`phase_gate_status=pending`，等待用户确认。

**Phase 1 完成落盘**（用户确认后）：
```bash
python3 -c "
import re, datetime, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
tokens = '{session_token_count}'
for k, v in [('last_completed_phase','phase1'),('next_phase','phase2'),('awaiting_user_confirmation_for','none'),('phase_gate_status','confirmed')]:
    c = re.sub(rf'(\| {re.escape(k)} +\| ).*?( \|)', rf'\g<1>{v}\2', c)
c = re.sub(r'(\| Phase 1 [^\|]+ \|[^\|]+\| )—( \| )—( \|)', rf'\g<1>{now}\2{tokens}k\3', c, count=1)
c = c.replace('- [ ] phase0-env-check', '- [x] phase0-env-check')
c = c.replace('- [ ] phase1-test-spec', '- [x] phase1-test-spec')
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Phase 1 state written')
"
```

---

## Phase 1.5 — OpenSpec change 初始化

**默认路径**：`agents/openspec/openspec-init-agent.md`

**触发条件**（orchestrator 在 Phase 1 确认门通过后立即判断）：

```
if plugin_availability.openspec.initialized == true
   AND execution-state.md 中 openspec_change_path == "—"（未填写）:
    → spawn openspec-init-agent，传入 feature_name、feature_dir、tech_local_path、project_root
    → 阻塞等待返回，写入 openspec_change_path 到 execution-state.md
else:
    → 静默跳过，进入 Phase 2
```

orchestrator 读取 `plugin_availability.openspec.initialized` 的来源：`{project_root}/.mrd-to-code-config.json`。

---

## Phase 2 — 实现代码（spawn `java-impl-agent`）

**默认路径**：`agents/java-impl/java-impl-agent.md`

启动前主会话必须先输出：`我现在开始调度 \`java-impl-agent\` 执行实现。`
再输出门控行：`[Phase 2] 唯一入口：<解析后实际路径>`，然后 Read → spawn。

**工具参数判断**（读 `{project_root}/.mrd-to-code-config.json` 的 `plugin_availability` 字段）：

| config 字段 | 判断条件 | 传入参数 |
|------------|---------|---------|
| `plugin_availability.gitnexus.installed == true` | **强制** | `gitnexus_mode=context` |
| `plugin_availability.autoresearch.installed == true` | **强制** | `autoresearch_mode=fix` |

两个参数**必须写入 `execution-state.md` 的 `dispatch_params` 行**，spawn 时从 execution-state.md 读取，**不得内联到 Task prompt 正文**。

- 传入 `feature_dir`、`tech_local_path`、`openspec_change_path`（若存在）
- `java-impl-agent` 内部优先读取 `{openspec_change_path}/tasks.md`（若 `openspec_change_path` 不为空），否则读技术方案 + 应用知识库
- 按任务顺序逐一实现；BLOCKER 扫描（B1-B10）；`mvn compile`（失败则自动修复，最多 3 轮）
- **只生成/修改生产代码**，测试代码统一在 Phase 4 生成

**阻塞等待**：`java-impl-agent` 完成并返回后才能进入 Phase 3。

**Phase 2 完成 — impl_context_snapshot.md 落盘（硬约束，不可跳过）**：

在写入 execution-state.md 之前，orchestrator 必须生成 `{feature_dir}/impl_context_snapshot.md`（≤100 行）：
- 变更文件清单（从 `java-impl-agent` 返回摘要中提取）
- 每文件变更说明（≤2句）
- 关键方法签名（新增/修改的 public 方法）
- 总行不超过 100 行（超出截断，保留文件清单 + 关键方法）

此文件作为 Phase 3 BLOCK 时 orchestrator 接管回溯的上下文基线，也是 Phase 5 失败时回溯 Phase 2 的起点。

**Phase 2 完成落盘**：
```bash
python3 -c "
import re, datetime, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
tokens = '{session_token_count}'
for k, v in [('last_completed_phase','phase2'),('next_phase','phase3')]:
    c = re.sub(rf'(\| {re.escape(k)} +\| ).*?( \|)', rf'\g<1>{v}\2', c)
c = re.sub(r'(\| Phase 2 [^\|]+ \|[^\|]+\| )—( \| )—( \|)', rf'\g<1>{now}\2{tokens}k\3', c, count=1)
c = c.replace('- [ ] phase2-impl-code', '- [x] phase2-impl-code')
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Phase 2 state written')
"
```

---

## Phase 3 — Code Review（spawn `java-review-agent`）

启动前主会话先输出：`我现在开始调度代码审查。`
再输出门控行：`[Phase 3] 唯一入口：<解析后实际路径>`，然后 Read → spawn。

**默认路径**：`agents/java-review/java-review-agent.md`

**Review 范围**：`Phase 2 变更清单` 对应文件的 diff "+" 行；清单缺失时降级为 `git diff HEAD` 的"+"行。仅审查新增/修改的生产代码，不含测试代码。

**GitNexus 背景输入约束**：若 `tech-design.md` 存在，必须优先读取其中「附录II：变更影响分析」作为背景；`java-review-agent` 只允许基于实际 diff 做增量 `gitnexus_get_callers` 核验，禁止重做全量 `gitnexus_impact`。

| 结果 | 动作 |
|------|------|
| L0 BLOCK | **orchestrator 接管回溯**：读取 `impl_context_snapshot.md` 作为上下文基线 → 直接 spawn `java-impl-agent(task=fix, context=impl_context_snapshot)` → 重新 Review，最多 3 轮；3 轮后仍 BLOCK → 写入 `review_result=BLOCK`，中断请求人工介入；**禁止 java-review-agent 内部无限自修复** |
| L1 WARN | 记录，继续 |
| PASS | 解除对 Phase 4 的阻塞 |

**正式完成判定**：必须同时具备 4 项凭证（门控行、Read 记录、spawn 记录、子代理返回摘要含 `review_result`），缺一视为「主会话越权产出」。

**Phase 3 完成落盘**：
```bash
python3 -c "
import re, datetime, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
tokens = '{session_token_count}'
for k, v in [('last_completed_phase','phase3'),('next_phase','phase4'),('review_result','{PASS_or_WARN_or_BLOCK}')]:
    c = re.sub(rf'(\| {re.escape(k)} +\| ).*?( \|)', rf'\g<1>{v}\2', c)
c = re.sub(r'(\| Phase 3 [^\|]+ \|[^\|]+\| )—( \| )—( \|)', rf'\g<1>{now}\2{tokens}k\3', c, count=1)
c = c.replace('- [ ] phase3-code-review', '- [x] phase3-code-review')
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Phase 3 state written')
"
```

---

## Phase 4 — 测试代码生成（spawn `testcode-gen-agent`）

**默认路径**：`agents/testcode-gen/testcode-gen-agent.md`

启动前主会话先输出：`我现在开始调度 \`testcode-gen-agent\` 生成测试代码。`
再输出门控行：`[Phase 4] 唯一入口：<解析后实际路径>`，然后 Read → spawn。

**依赖前置**：读取 `execution-state.md` 中的 `test_deps_confirmed`，若 `true` 则直接跳过依赖检测；若缺失则退回 Phase 0 补做，**禁止**在本阶段追加依赖。

- 强制调用链溯源（找真实入口）；Mock 边界分析
- 生成测试类（`src/test/java/.../tdd/`）
- **只允许生成 `.java` 文件**，禁止 Groovy/Spock
- `mvn compile` 修复（直到编译通过）；JaCoCo 配置检查

**正式完成判定**：必须同时具备 4 项凭证（门控行、Read 记录、spawn 记录、`testcode-gen-agent` 返回摘要），缺一视为「主会话越权产出」。

**Phase 4 完成落盘**（`next_phase` 必须写 `phase5`，硬约束）：
```bash
python3 -c "
import re, datetime, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
tokens = '{session_token_count}'
for k, v in [('last_completed_phase','phase4'),('next_phase','phase5')]:
    c = re.sub(rf'(\| {re.escape(k)} +\| ).*?( \|)', rf'\g<1>{v}\2', c)
c = re.sub(r'(\| Phase 4 [^\|]+ \|[^\|]+\| )—( \| )—( \|)', rf'\g<1>{now}\2{tokens}k\3', c, count=1)
c = c.replace('- [ ] phase4-test-code', '- [x] phase4-test-code')
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Phase 4 state written')
"
```

---

## Phase 5 — 测试执行与覆盖率诊断（spawn `tdd-test-runner-agent`）

**默认路径**：`agents/tdd-test-runner/tdd-test-runner-agent.md`

启动前主会话先输出：`我现在开始调度 \`tdd-test-runner-agent\` 执行测试与覆盖率诊断。`
再输出门控行：`[Phase 5] 唯一入口：<解析后实际路径>`，然后 Read → spawn。

**输入**：`{feature_dir}/test_file_list.md`
**执行**：测试运行 + JaCoCo 全量覆盖率 + 精确增量覆盖率 + 测试报告生成
**口径**：JUnit 只在 `mvn test` 阶段执行一次；`jacoco:report` 与增量脚本仅消费同一份 `jacoco.exec`

**达标标准**：精确增量**行**覆盖率 ≥ 80% **且** 测试通过率 100%（分支覆盖率仅作诊断参考，**不作为门槛**）。

诊断决策树与修复优先级详见 `assets/decision-trees.md`。

**Phase 5 达标落盘**：
```bash
python3 -c "
import re, datetime, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
tokens = '{session_token_count}'
for k, v in [('last_completed_phase','phase5'),('next_phase','phase6'),('phase5_dod_met','true'),('test_pass_rate','100%')]:
    c = re.sub(rf'(\| {re.escape(k)} +\| ).*?( \|)', rf'\g<1>{v}\2', c)
c = re.sub(r'(\| Phase 5 [^\|]+ \|[^\|]+\| )—( \| )—( \|)', rf'\g<1>{now}\2{tokens}k\3', c, count=1)
c = c.replace('- [ ] phase5-test-run', '- [x] phase5-test-run')
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Phase 5 dod_met state written')
"
```

---

## Phase 6 — 汇总结果 / 可选提交

**pre-commit 门控**（硬约束）：`git commit` 前必须先调度 `tdd-test-runner-agent` 执行一次最终跑测，确认通过率 100% 且精确增量行覆盖率 ≥80%；输出门控行：`[Phase 6] pre-commit 验证：<tdd-test-runner-agent 实际路径>`；跑测未达标 → 退回 Phase 2 修复入口（test_retry_count++），禁止直接 commit。

输出汇总（含最终通过率、覆盖率、变更文件列表）；若用户明确要求则执行 `git commit`。

**Phase 6 完成落盘**：
```bash
python3 -c "
import re, datetime, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
tokens = '{session_token_count}'
for k, v in [('last_completed_phase','phase6'),('next_phase','none'),('skill_completion_status','completed')]:
    c = re.sub(rf'(\| {re.escape(k)} +\| ).*?( \|)', rf'\g<1>{v}\2', c)
c = re.sub(r'(\| Phase 6 [^\|]+ \|[^\|]+\| )—( \| )—( \|)', rf'\g<1>{now}\2{tokens}k\3', c, count=1)
c = c.replace('- [ ] phase6-summary', '- [x] phase6-summary')
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Phase 6 state written')
"
```

---

## 并行化说明

**Phase 1 并行的依据**：`tdd-test-spec-agent` 只读需求/技术方案（或 OpenSpec 产物），完全不依赖实现代码；提前生成可消除 Phase 4 对 test_spec 的等待。

**同步点**：
- Phase 2 严格阻塞等待 Phase 1 确认门（用户确认）
- Phase 3 严格阻塞等待 `java-impl-agent` 返回
- Phase 4 严格阻塞等待 Phase 3 通过（`review_result ≠ FAIL`）
- Phase 1 互 Review 串行（仅经典模式触发 openspec-archive 时适用）：Task A 完成后 Task B 才能启动
