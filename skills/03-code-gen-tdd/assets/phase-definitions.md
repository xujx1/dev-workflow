# Phase 定义 — 03-code-gen-tdd 流水线全景

> ⚠️ **全局阻塞声明**：orchestrator 在启动任何 spawn 后**必须留守等待**，直到当前 Phase 全部 Task 返回后，才能进入下一 Phase。禁止 spawn 后立即返回或中断。
>
> ⚠️ **严格顺序执行**：必须严格按 Phase 0 → 0.5 → 1 → 1互Review → 1确认门 → 1.5 → 1.6 → 2 → 3 → 4 → 5 → 6 顺序推进。禁止跳过任一 Phase，禁止将多个 Phase 合并为一次性生成。
>
> ⚠️ **执行节奏**：单次调用默认只执行当前待执行阶段；只有显式 `--auto` 时才允许连续推进，且最多连续 2 个 Phase。
>
> ⚠️ **Task prompt 构造约束（硬约束，违反即 "Prompt is too long"）**：spawn 任何 agent 时，Task prompt 只允许包含文件路径和小体积元数据（feature_dir, tech_local_path, prd_local_path, kb_local_path, test_spec_path, config_path, tech_stack, template_set 等），**禁止内联任何文件内容**（tech-design.md 正文、test_spec 正文、CONTEXT.md 内容、代码文件、diff 全文等）。所有大文本由被 spawn 的 agent 自行 Read。

---

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

## Phase 0.5 — 技术栈检测与模板路由

### 技术栈读取流程

1. **读取配置文件**：读取 `{project_root}/.mrd-to-code-config.json`
2. **提取技术栈**：
   - 优先读取 `project.tech_stack` 字段
   - 若缺失，读取 `code_gen.template_set` 字段反推技术栈
   - 若两者均缺失 → 默认 `tech_stack=java-spring-boot`

3. **模板集路由**：

| tech_stack | template_set | 生成策略 | 目标 Agent |
|------------|--------------|----------|------------|
| `java-spring-boot` | `java-spring-boot-v2` | Controller/Service/Repository 分层 | `java-impl-agent` |
| `nodejs-express` | `nodejs-express-v1` | router/service/model 分层 | `nodejs-impl-agent` |
| `python-fastapi` | `python-fastapi-v1` | router/service/schema 分层 | `python-impl-agent` |
| `kotlin-ktor` | `java-spring-boot-v2` | Controller/Service/Repository 分层 | `java-impl-agent` |

4. **模板路径解析**：
   - 查找顺序：`{project_root}/.workflow/templates/{template_set}/` → `{repo_root}/.workflow/templates/{template_set}/` → `$HOME/.claude/plugins/dev-workflow/.workflow/templates/{template_set}/`
   - 必须包含：`code-gen-prompt.md`、`test-gen-prompt.md`、`review-checklist.md`、`artifact-contract.yml`

### 跨系统接口依赖处理

若技术方案中声明了跨系统依赖：
```yaml
dependencies:
  - service: "payment-service"
    interface: "PaymentGateway.charge"
    contract_ref: "payment-service/knowledge-base/domain/payment/api-contract.md"
    mock_strategy: "mock-first"
```

自动读取 `contract_ref` 文件，生成对应 mock 接口代码。

### 落盘字段

```bash
python3 -c "
import re, pathlib
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
for k, v in [('tech_stack','{tech_stack}'),('template_set','{template_set}')]:
    c = re.sub(rf'(\| {re.escape(k)} +\| ).*?( \|)', rf'\g<1>{v}\2', c)
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Phase 0.5 tech stack written')
"
```

### OpenSpec 初始化检测（条件触发）

**默认路径**：`agents/openspec/openspec-init-agent.md`

**触发条件**（按优先级判断）：
1. 读取 `{project_root}/.mrd-to-code-config.json`，检查 `openspec` 配置是否完整。
2. 如果 `openspec` 配置缺失或不完整，检测本地 OpenSpec 是否可用（`openspec --version` 或项目封装命令）。
3. 如果 OpenSpec 已安装但配置缺失，自动补全配置：
   - `openspec.enabled = true`
   - `openspec.generate_stage = "before_code_gen"`
   - `openspec.archive_in_stage4 = true`
   - `openspec.initialized = true`（仅在检测到本地已有 OpenSpec 仓库时）
4. 检测 `openspec_change_path` 是否为空：
   - 为空 → 调度 `openspec-init-agent`
   - 非空 → 静默跳过

**执行步骤**：
1. 检查配置与本地 OpenSpec 状态。
2. 如需初始化，spawn `openspec-init-agent`，仅传入 `feature_name`、`feature_dir`、`tech_local_path`、`project_root`。
3. 阻塞等待 agent 完成，将 `openspec_change_path` 写入 `execution-state.md`。

---

## Phase 1 — 测试规格

**输入约束**：纯读需求/方案，不依赖实现代码。
- **full 模式**：MRD + PRD + 技术方案（或 OpenSpec change 产物）
- **tech-only 模式**：仅技术方案 `tech_local_path` / OpenSpec `openspec_change_path`

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
c = c.replace('- [ ] phase0.5-tech-stack', '- [x] phase0.5-tech-stack')
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

## Phase 1.6 — OpenSpec apply

**默认路径**：`agents/openspec/openspec-apply-agent.md`

**触发条件**：
`openspec_change_path` 非空且 `{openspec_change_path}/tasks.md` 存在。

**执行步骤**：
1. 检查 `openspec_change_path` 和 `tasks.md` 是否存在。
2. 如果存在 → 调度 `openspec-apply-agent`：
   - 传入 `openspec_change_path`、`feature_dir`、`feature_name`
   - 阻塞等待 agent 完成
3. agent 返回后，将 `openspec_tasks_total` / `openspec_tasks_done` / `openspec_apply_status` 写入 `execution-state.md`。

**落盘脚本**：
```bash
python3 -c "
import datetime, pathlib, re
f = '{feature_dir}/execution-state.md'
c = pathlib.Path(f).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
tokens = '{session_token_count}'
c = c.replace('- [ ] phase1_6-openspec-apply', '- [x] phase1_6-openspec-apply')
for k, v in [('last_completed_phase','phase1_6'),('next_phase','phase2')]:
    c = re.sub(rf'(\| {re.escape(k)} +\| ).*?( \|)', rf'\g<1>{v}\2', c)
c = re.sub(r'(\| Phase 1\.6 [^\|]+ \|[^\|]+\| )—( \| )—( \|)', rf'\g<1>{now}\2{tokens}k\3', c, count=1)
pathlib.Path(f).write_text(c, encoding='utf-8')
print('Phase 1.6 state written')
"
```

---

## Phase 2 — 实现代码（根据 tech_stack 路由到对应 Agent）

**默认路径**：根据 `tech_stack` 路由：

| tech_stack | Agent 路径 |
|------------|-----------|
| `java-spring-boot` | `agents/java-impl/java-impl-agent.md` |
| `nodejs-express` | `agents/nodejs-impl/nodejs-impl-agent.md` |
| `python-fastapi` | `agents/python-impl/python-impl-agent.md` |
| `kotlin-ktor` | `agents/java-impl/java-impl-agent.md` |

启动前主会话必须先输出：`我现在开始调度 `{agent_name}` 执行实现。`
再输出门控行：`[Phase 2] 唯一入口：<解析后实际路径>`，然后 Read → spawn。

**工具参数判断**（读 `{project_root}/.mrd-to-code-config.json` 的 `plugin_availability` 字段）：

| config 字段 | 判断条件 | 传入参数 |
|------------|---------|---------|
| `plugin_availability.gitnexus.installed == true` | **强制** | `gitnexus_mode=context` |
| `plugin_availability.autoresearch.installed == true` | **强制** | `autoresearch_mode=fix` |

**技术栈特定参数**：
- `tech_stack`：当前技术栈
- `template_set`：目标模板集
- `template_path`：模板集实际路径

两个参数**必须写入 `execution-state.md` 的 `dispatch_params` 行**，spawn 时从 execution-state.md 读取，**不得内联到 Task prompt 正文**。

- 传入 `feature_dir`、`tech_local_path`、`openspec_change_path`（若存在）、`tech_stack`、`template_set`
- Agent 内部优先读取 `{openspec_change_path}/tasks.md`（若 `openspec_change_path` 不为空），否则读技术方案 + 应用知识库
- Agent 读取 `{template_path}/code-gen-prompt.md` 获取代码生成规范
- 按任务顺序逐一实现；BLOCKER 扫描；构建编译（失败则自动修复，按 assets/decision-trees.md 第七节「自动修复停止条件」执行）
- **只生成/修改生产代码**，测试代码统一在 Phase 4 生成

**阻塞等待**：Agent 完成并返回后才能进入 Phase 3。

**Phase 2 完成 — impl_context_snapshot.md 落盘（硬约束，不可跳过）**：

在写入 execution-state.md 之前，orchestrator 必须生成 `{feature_dir}/impl_context_snapshot.md`（≤100 行）：
- 变更文件清单（从 Agent 返回摘要中提取）
- 每文件变更说明（≤2句）
- 关键方法签名（新增/修改的 public 方法）
- 技术栈标识
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

## Phase 3 — Code Review（根据 tech_stack 路由到对应 Agent）

启动前主会话先输出：`我现在开始调度代码审查。`
再输出门控行：`[Phase 3] 唯一入口：<解析后实际路径>`，然后 Read → spawn。

**默认路径**：根据 `tech_stack` 路由：

| tech_stack | Agent 路径 | Review 检查清单路径 |
|------------|-----------|-------------------|
| `java-spring-boot` | `agents/java-review/java-review-agent.md` | `.workflow/templates/java-spring-boot-v2/review-checklist.md` |
| `nodejs-express` | `agents/nodejs-review/nodejs-review-agent.md` | `.workflow/templates/nodejs-express-v1/review-checklist.md` |
| `python-fastapi` | `agents/python-review/python-review-agent.md` | `.workflow/templates/python-fastapi-v1/review-checklist.md` |
| `kotlin-ktor` | `agents/java-review/java-review-agent.md` | `.workflow/templates/java-spring-boot-v2/review-checklist.md` |

**Review 范围**：`Phase 2 变更清单` 对应文件的 diff "+" 行；清单缺失时降级为 `git diff HEAD` 的"+"行。仅审查新增/修改的生产代码，不含测试代码。

**GitNexus 背景输入约束**：若 `tech-design.md` 存在，必须优先读取其中「附录II：变更影响分析」作为背景；Review Agent 只允许基于实际 diff 做增量 `gitnexus_get_callers` 核验，禁止重做全量 `gitnexus_impact`。

| 结果 | 动作 |
|------|------|
| L0 BLOCK | **orchestrator 接管回溯**：读取 `impl_context_snapshot.md` 作为上下文基线 → 直接 spawn 实现 Agent(task=fix, context=impl_context_snapshot) → 重新 Review，按 assets/decision-trees.md 第七节执行；仍 BLOCK → 写入 `review_result=BLOCK`，中断请求人工介入；**禁止 Review Agent 内部无限自修复** |
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

## Phase 4 — 测试代码生成（根据 tech_stack 路由到对应 Agent）

**默认路径**：根据 `tech_stack` 路由：

| tech_stack | Agent 路径 | 测试生成提示路径 |
|------------|-----------|----------------|
| `java-spring-boot` | `agents/testcode-gen/testcode-gen-agent.md` | `.workflow/templates/java-spring-boot-v2/test-gen-prompt.md` |
| `nodejs-express` | `agents/nodejs-testcode-gen/nodejs-testcode-gen-agent.md` | `.workflow/templates/nodejs-express-v1/test-gen-prompt.md` |
| `python-fastapi` | `agents/python-testcode-gen/python-testcode-gen-agent.md` | `.workflow/templates/python-fastapi-v1/test-gen-prompt.md` |
| `kotlin-ktor` | `agents/testcode-gen/testcode-gen-agent.md` | `.workflow/templates/java-spring-boot-v2/test-gen-prompt.md` |

启动前主会话先输出：`我现在开始调度 `{agent_name}` 生成测试代码。`
再输出门控行：`[Phase 4] 唯一入口：<解析后实际路径>`，然后 Read → spawn。

**依赖前置**：读取 `execution-state.md` 中的 `test_deps_confirmed`，若 `true` 则直接跳过依赖检测；若缺失则退回 Phase 0 补做，**禁止**在本阶段追加依赖。

- 强制调用链溯源（找真实入口）；Mock 边界分析
- Agent 读取 `{template_path}/test-gen-prompt.md` 获取测试生成规范
- 生成测试类（按技术栈约定的测试目录）
- 构建编译修复（按 `assets/decision-trees.md` 第七节「自动修复停止条件」执行）；覆盖率配置检查

**正式完成判定**：必须同时具备 4 项凭证（门控行、Read 记录、spawn 记录、测试代码生成 Agent 返回摘要），缺一视为「主会话越权产出」。

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

## Phase 5 — 测试执行与覆盖率诊断（根据 tech_stack 路由到对应 Agent）

**默认路径**：根据 `tech_stack` 路由：

| tech_stack | Agent 路径 |
|------------|-----------|
| `java-spring-boot` | `agents/tdd-test-runner/tdd-test-runner-agent.md` |
| `nodejs-express` | `agents/nodejs-test-runner/nodejs-test-runner-agent.md` |
| `python-fastapi` | `agents/python-test-runner/python-test-runner-agent.md` |
| `kotlin-ktor` | `agents/tdd-test-runner/tdd-test-runner-agent.md` |

启动前主会话先输出：`我现在开始调度 `{agent_name}` 执行测试与覆盖率诊断。`
再输出门控行：`[Phase 5] 唯一入口：<解析后实际路径>`，然后 Read → spawn。

**输入**：`{feature_dir}/test_file_list.md`
**执行**：测试运行 + 覆盖率工具全量覆盖率 + 精确增量覆盖率 + 测试报告生成
**口径**：测试框架只执行一次；覆盖率工具与增量脚本仅消费同一份覆盖率数据

**达标标准**：精确增量**行**覆盖率 ≥ 80% **且** 测试通过率 100%（分支覆盖率仅作诊断参考，**不作为门槛**）。

诊断决策树与修复优先级详见 `assets/decision-trees.md`；**自动修复（Autofix）循环的全部停止条件（STOP_01 max_attempts / STOP_02 无进展 / STOP_03 回归 / STOP_04 编译连续失败 / STOP_05 超时）、autofix-history.md 落盘格式及人工介入提示模板见同文件第七节**。

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

**pre-commit 门控**（硬约束）：`git commit` 前必须先调度测试执行 Agent 执行一次最终跑测，确认通过率 100% 且精确增量行覆盖率 ≥80%；输出门控行：`[Phase 6] pre-commit 验证：<测试执行 Agent 实际路径>`；跑测未达标 → 退回 Phase 2 修复入口（test_retry_count++），禁止直接 commit。

输出汇总（含最终通过率、覆盖率、变更文件列表、技术栈信息）；若用户明确要求则执行 `git commit`。

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
- Phase 3 严格阻塞等待实现 Agent 返回
- Phase 4 严格阻塞等待 Phase 3 通过（`review_result ≠ FAIL`）
- Phase 1 互 Review 串行（仅经典模式触发 openspec-archive 时适用）：Task A 完成后 Task B 才能启动

---

## 多系统知识库隔离

**Monorepo 场景**（多系统在同一 repo）：
```
repo-root/
├── order-service/
│   ├── .mrd-to-code-config.json
│   └── knowledge-base/
│       ├── CONTEXT.md
│       └── domain/
├── payment-service/
│   ├── .mrd-to-code-config.json
│   └── knowledge-base/
│       ├── CONTEXT.md
│       └── domain/
└── .workflow/               # 共享 Orchestrator 配置
    └── templates/           # 共享模板集
```

每个子系统独立读取自己的 `knowledge-base/` 目录，避免跨系统污染。

**独立 Repo 场景**：每个系统有自己的完整 Harness 安装，知识库天然隔离。
