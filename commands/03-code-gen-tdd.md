---
description: 分阶段可恢复的代码生成主入口：进入 Phase 1 前先确认并按需回读技术方案，Phase 2～5（实现→审查→测码→跑测）默认同轮连续。
argument-hint: [--plan | --resume | --to phaseN | --auto]
---

# /03-code-gen-tdd — 生成代码（含单元测试）

传统斜杠命令兼容入口。实际工作流在 `skills/03-code-gen-tdd/SKILL.md`。

## 使用前提醒

本命令进入正式 Skill 前，先读取 `.mrd-to-code-config.json` 的 `plugin_availability` 字段。

| 标志位 | 影响能力 |
|--------|---------|
| `l3_gitnexus=available` | Phase 3 Code Review 阶段 `java-review-agent` 必须优先读取 `tech-design.md` 中的附录II |
| `l4_autoresearch=available` | Phase 5 TDD 循环调试阶段自动追加修复分析 |

> 如需安装插件，请运行：`/dev-workflow:00-init`

## 说明

- 本命令只做编排，不直接生成 `test_spec`、测试代码或测试报告。
- `phase1` 启动前检查本地 `{feature_dir}/tech-design.md` 是否存在，存在则直接使用。
- `phase1`～`phase5` 的主链只依赖 5 个角色；若使用飞书确认版技术方案，启动前额外调度 `feishu-doc-sync-agent` 做回读同步：
  1. `tdd-test-spec-agent`
  2. `java-impl-agent`
  3. `java-review-agent`
  4. `testcode-gen-agent`
  5. `tdd-test-runner-agent`
- 上述 5 个角色都必须被**实际派发并阻塞等待完成**；默认先走 `primary_dispatch`，若子 Agent 启动失败或产物未落盘，再退化为 `serial_retry` 串行真实 spawn；若仍失败则停在当前 Phase，**不得**由主会话代执行
- `**phase2`～`phase5` 须同一次调度内连续完成**（中间不要求「继续 Phase 3/4/5」），除非 `review_result = BLOCK` 或回流链打断；`phase1`→`phase2` 仍保留确认门。
- `phase3` 默认使用单个 `java-review-agent` 串行 Review；只有环境稳定且改动适合切分时，才允许阶段内按类/文件分片并行派发 `java-review-agent`。待聚合 `review_result` 非 BLOCK 后再进入 `phase4`；**禁止**把 `phase3` 与 `phase4` 直接并行。
- OpenSpec 仍按项目 `.mrd-to-code-config.json` 的复杂度阈值条件触发；`phase1` 为 `test_spec + OpenSpec（可选）`
- 测试模式固定为 `mock-first`：JUnit4 + Mockito，禁止连接真实 DB/Redis
- `execution-state.md` 的门禁字段必须在 `phase2`～`phase5` 的每次推进、回流、终止性故障分类后同步更新，不能停留在旧阶段；主要 Read 路径、耗时明细等补充信息可异步补写。
- `phase5` 中 JUnit 用例只由 `mvn test` 执行一次；`jacoco:report` 与增量覆盖脚本仅消费同一份 `jacoco.exec`，不得把补充覆盖率 HTML/XML 落到 `req/.../test/_jacoco_feature/`

## 路径约定

- `project_root` = 当前业务工程根目录，即执行本流程时的 `$PWD`；`app-knowledge-base/`、`.mrd-to-code-config.json`、`req/`、`src/` 等工程路径都相对这里解析。
- `skill_root` = `$HOME/.claude/plugins/dev-workflow`（固定安装路径）
- 裸 `agents/...` 路径默认不相对业务工程解析；应优先按 `config.agents.agents_dir` 查找，再按 `{project_root}/.claude/agents/` 回退，最后回退到 `$HOME/.claude/plugins/dev-workflow/agents/`。
- 裸 `rules/test/...`、`rules/java/...`、`agents/*/assets/...` 视为随 Skill 分发的固定资源，默认相对 `$HOME/.claude/plugins/dev-workflow` 解析。

## Phase

1. `phase1`：`tdd-test-spec-agent`
2. `phase2`：`java-impl-agent`
3. `phase3`：`java-review-agent`（串行，输出 `{feature_dir}/code-review.md`）
4. `phase4`：`testcode-gen-agent`
5. `phase5`：`tdd-test-runner-agent`
6. `phase6`：汇总结果 / 可选提交

固定回流链（详见 `skills/03-code-gen-tdd/SKILL.md`）：

1. **R1** 审查未过：回 `java-impl-agent`，再 `java-review-agent` 直至非 BLOCK
2. **R2** 单测未通过：回 `java-impl-agent` → `java-review-agent` → `tdd-test-runner-agent`（根因在测码时先 `phase4`）
3. **R3** 覆盖率不足（默认门禁 **80%** 精确增量行）：**优先** `tdd-test-spec-agent(supplement-coverage)` → `testcode-gen-agent` → `tdd-test-runner-agent`；仅当判定纯测码遗漏时才允许单次 `phase4`→`phase5`
4. **R4** Runner 编译失败：回 `testcode-gen-agent` → `tdd-test-runner-agent`（根因在 `src/main` 时改按 R2）
5. **R5** Runner 资产故障：`JacocoReport$1`、缓存损坏、未知参数、classpath 失效等覆盖率工具问题；停止业务回流，先修 Runner 资产再重试 `phase5`

## 调用方式

应用 `skills/03-code-gen-tdd` 技能。

**参数**：`$ARGUMENTS` — 执行控制参数。

进入 `phase1`～`phase5` 前，主会话必须先解析对应 Agent 的实际路径并写入执行契约；不得直接把业务仓下不存在的 `agents/...` 当作默认路径。派发时必须记录 `dispatch_mode`、`dispatch_attempt`、`dispatch_status`：默认先走 `primary_dispatch`，失败后才允许一次 `serial_retry`。若失败原因属于 Agent 文档缺失、必需输入缺失或正式产物路径无法判定，则不得重试，而应直接写入 `dispatch_failed_agent`、`dispatch_error_summary`、`failure_category=agent_dispatch_failure` 并停止。`phase1` 完成后必须确认 `execution-state.md` 已写入本阶段过程数据与主要读取路径。`phase3` 若启用并行 shard Review，必须先写入 `review_scope_manifest` / 派发清单，且切分遵循”文件互斥、强耦合文件不拆散、改动很小时不分片”的规则；所有 shard 完成并生成聚合报告后才能标记 `phase3` 完成。`phase5` 结果必须先完成 `runner_asset_failure / compile_failure / test_failure / coverage_below_threshold` 根因分类，再决定是否回流。

## 推荐用法

- `/03-code-gen-tdd --plan`
  - 只列本轮契约，不执行
- `/03-code-gen-tdd --resume`
  - 从 `execution-state.md` 恢复下一阶段
- `/03-code-gen-tdd --to phaseN`
  - 声明目标阶段；编排仍以 `skills/03-code-gen-tdd/SKILL.md` 为准（`phase2`～`phase5` 默认连续段）
- `/03-code-gen-tdd --resume --auto`
  - 在 `phase5` 已完成时，允许同会话再推进后续 Phase（如 `phase6`），单次最多再执行 2 个 Phase

## 计时规范

遵循 `rules/common/timing-spec.md`。Phase 定义：

| 步骤编号 | 步骤名称 | 参考预算 |
|---------|---------|---------|
| P0 | 技术方案版本确认（feishu 回读，可选） | — |
| P1 | phase1: tdd-test-spec-agent | 3-4 分钟 |
| P2 | phase2: java-impl-agent | 4-5 分钟 |
| P3 | phase3: java-review-agent | 含 P2 预算 |
| P4 | phase4: testcode-gen-agent | 10-12 分钟 |
| P5 | phase5: tdd-test-runner-agent | 8-10 分钟 |
| P6 | phase6: 汇总结果 / 可选提交 | — |

报表子章节：`### /03-code-gen-tdd 耗时报表`。报表分两层：Phase 汇总 + Agent 内部步骤明细（各 Agent 步骤定义见对应 Agent 文件的计时规范章节）。回流时行尾标注 `[回流第N次]`。

