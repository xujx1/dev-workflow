# 门禁规则 — 03-code-gen-tdd

## 一、执行契约表（每次调用必须先输出）

```md
本次模式：--resume | --to phaseN | --plan | --auto
当前阶段：Phase X
本轮目标：执行到 Phase Y 后停止

- Agent：<唯一允许的 agent 名称 / 路径>
- 输入：<本阶段必需输入>
- 正式产物：<本阶段必须落盘的文件>
- 阻塞条件：<进入下一阶段前必须满足的条件>
- 禁止动作：<主会话本阶段禁止的 shortcut>
```

若未先输出执行契约表，**不得**直接进入 Explore、文件修改、跑测、Review 或子 Agent 调度。

---

## 二、Token 优化门禁（P0 硬约束）

每次 Phase 推进前必须执行以下检查，未通过则禁止推进。

### 检查清单

1. 读取 `execution-state.md` 中的 `consecutive_phases_count` 字段
2. 检查是否达到连续 Phase 上限（≥2）
3. **context-budget 检查**（`l4_context_budget=available` 时执行）：调用 `/context-budget` 获取当前 token 估算；budget 剩余 <30% 时强制停止并提示 `/compact`
4. 输出门禁状态表（必须输出）：

```markdown
## 门禁检查

| 检查项 | 当前值 | 阈值 | 状态 |
|--------|--------|------|------|
| consecutive_phases_count | {n} | ≤2 | ✅/❌ |
| session_token_count (估算) | {n}k | <50k | ✅/❌ |
| compact_hint_shown | {bool} | — | — |
| context_budget_remaining | {n}% | ≥30% | ✅/❌ |

**决策**：{允许推进 / 停下汇报，提示 /compact}
```

### 强制中断规则

| 条件 | 动作 |
|------|------|
| `consecutive_phases_count >= 2` | **立即停止**，输出状态，提示 `/compact` |
| `session_token_count >= 50k` | **立即停止**，输出状态，提示 `/compact` |
| `context_budget_remaining < 30%` | **立即停止**，输出状态，提示 `/compact` |
| 用户未确认继续 | **禁止进入下一个 Phase** |

### Phase 完成后必须更新 execution-state.md

**变量传递区**（`python3 -c` 写入）：

```markdown
| 字段 | 值 |
|------|----|
| consecutive_phases_count | {n} |
| session_token_count | {n}k |
| compact_hint_shown | {bool} |
| last_completed_phase | phase{n} |
| next_phase | phase{n+1} |
| test_retry_count | {n} |
| coverage_retry_count | {n} |
```

**Phase 产出物落盘验证**（每个 Phase 完成后，写入 execution-state.md 前必须执行）：

```bash
# 根据 Phase 不同验证对应产出物是否存在
# Phase 1: test_spec.md
test -f "{feature_dir}/test_spec.md" || { echo "FATAL: Phase 1 正式产物 test_spec.md 缺失，禁止继续"; exit 1; }
# Phase 2: impl_context_snapshot.md（见 phase-definitions.md Phase 2 节）
# Phase 4: test_file_list.md
test -f "{feature_dir}/test_file_list.md" || { echo "FATAL: Phase 4 正式产物 test_file_list.md 缺失，禁止继续"; exit 1; }
```

验证失败 → **禁止更新 execution-state.md，禁止进入下一 Phase，必须提示用户**。

**阶段状态表完成时间和消耗Token**（同一个 python3 脚本里一并写入，格式 `%Y-%m-%d %H:%M:%S`）：

```python
import re, datetime, pathlib
state_file = '{feature_dir}/execution-state.md'
content = pathlib.Path(state_file).read_text(encoding='utf-8')
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
tokens = '{session_token_count}'  # 本阶段消耗，单位 k，取整
# 将当前 Phase 对应行的两个 — 替换为时间和 token（count=1 防误替换）
content = re.sub(
    r'(\| Phase {n} [^\|]+ \|[^\|]+\| )—( \| )—( \|)',
    rf'\g<1>{now}\2{tokens}k\3',
    content,
    count=1
)
pathlib.Path(state_file).write_text(content, encoding='utf-8')
```

---

## 三、默认执行策略

> ⚠️ Token 优化约束（P0）：禁止连续推进 ≥3 个 Phase；即使 `--auto`，最多连续 2 个 Phase 后必须停下汇报。

| 节点 | 默认行为 |
|------|---------|
| Phase 0→1 | 执行后**停下，等用户确认** |
| Phase 1 确认后 → Phase 1.5 | 条件检查（openspec.initialized=true 且 openspec_change_path 为空时执行）；静默完成后**自动进入 Phase 2** |
| Phase 1.5 → Phase 2 | 执行 Phase 2，**停下汇报**，提示 `/compact` |
| Phase 2→3 | 可连续执行（最多 2 个 Phase） |
| Phase 3→4 | **停下汇报**，提示 `/compact` |
| Phase 4→5 | **停下汇报**，提示 `/compact` |
| Phase 3 BLOCK | Phase 3 内部自动修复（最多 3 轮）；3 轮后仍 BLOCK → 中断请求人工介入 |
| Phase 5 未达标 | 本轮只输出诊断，禁止自动跨 Phase 回溯，等待下一轮 `--resume` |
| Phase 5 达标 | **停下汇报**，等用户确认后进 Phase 6 |
| `test_retry_count >= 3` | **强制停止**，输出诊断报告，请求人工介入；禁止第 4 轮自动回溯 |
| `coverage_retry_count >= 3` | **强制停止**，输出诊断报告，请求人工介入；禁止第 4 轮自动补充 |

**Orchestrator 状态读取瘦身**：
- 只读 `execution-state.md` 前 50 行摘要
- 禁止读详细日志（`unit_test_report_*.md`、完整 code-review 报告）
- 禁止一次性 Read ≥3 个知识库文件；知识库注入总行数 ≤350 行

**Orchestrator 禁止清单**：
- ❌ 禁止在主会话中生成代码/测试/Review（必须通过专职 Agent）
- ❌ 禁止直接调用 `mvn test`、`mvn compile` 等构建命令
- ❌ 禁止一次性 Read ≥3 个知识库文件
- ❌ 禁止连续推进 ≥3 个 Phase（即使 `--auto`）
- ❌ 禁止手动 `find jar + javac` 拼 classpath 编译（漏传递依赖 → 假性失败）
- ❌ 禁止基于 Phase 4/5 编译失败自行修改 pom.xml 或追加 jar（Phase 0 已写 `test_deps_confirmed=true` 后不可再追加）

---

## 四、防跑偏硬门

### Phase 1 防实现污染

Phase 1 期间，`tdd-test-spec-agent` 和 `openspec-archive-agent` **禁止**读取：
- 工程 `src/main/java/**`、`src/test/**`
- `git diff` / `git status` / 编译输出
- 任何先前已生成的实现代码、测试代码、测试报告

**Phase 1 合法输入**：
- full 模式：MRD / PRD / tech-design / 测试规范 / 测试知识库 / OpenSpec
- tech-only 模式：tech-design / 测试规范 / 测试知识库 / OpenSpec（MRD / PRD 不在合法范围）

一旦发现 Phase 1 读取了实现/测试代码，**立即判定本轮 Phase 1 无效**，提示"test_spec 可能已被实现污染，需重新生成"。

### Phase 间显式提示

每次阶段切换前，orchestrator **必须显式提示**：当前进入 Phase X、上一阶段正式产物、进入下一阶段的阻塞条件。
- `Phase 2` 启动前：`Phase 1 正式产物已生成并已获用户确认`
- `Phase 4` 启动前：`Phase 3 review_result ≠ BLOCK`
- `Phase 5` 启动前：`test_file_list.md 已落盘，Runner 将只按清单执行`

### Phase 3 Review 基线

- 优先级：① 读取 `Phase 2 变更清单` → ② 清单缺失时降级为 `git diff HEAD`
- 若两者均缺失：**禁止**直接 PASS，必须中断并提示用户

### Phase 3→5 主会话禁止清单

> 约束针对本 Skill 的 orchestrator / 主会话。子 Agent 在其 agent 文档允许范围内仍可执行 `mvn` 等动作。

**Phase 3 进行中**：
- 禁止对工程 `src/test/**` 做 Write/StrReplace/补丁式修改
- 禁止以「先写单测验证」「Explore 现有 Test 顺手改」为由创建或修改 `*Test.java`

**Phase 3 正式完成判定**（4 项凭证缺一不可）：门控行、Read 记录、spawn 记录、`java-review-agent` 返回摘要（含 `review_result`）

**进入 Phase 4 的门控**：必须先解析 `testcode-gen-agent` 实际路径，再 Read + spawn；未 Read + 未 spawn 前禁止对测试源码做任何实质产出。

**Phase 4 正式完成判定**（4 项凭证缺一不可）：门控行、Read 记录、spawn 记录、`testcode-gen-agent` 返回摘要

**`test_file_list.md` 落盘前（Phase 4 未完成）**：
- 禁止修改 `**/src/test/**`
- 禁止以「先跑 mvn test 验证」为由触发 `mvn test` / `mvn verify` / surefire

**Phase 5**：主会话唯一合法入口为先解析 `tdd-test-runner-agent` 实际路径，再 Read + spawn；禁止裸终端 `mvn test` / `mvn verify` 替代 Runner 结论。

**Phase 5 正式完成判定**（4 项凭证缺一不可）：门控行、Read 记录、spawn 记录、`tdd-test-runner-agent` 返回摘要

**阶段门控复述（强制）**：每进入 Phase 3/4/5，主会话必须先输出：
`[Phase N] 唯一入口：<按 agents_dir / project_root/.claude/agents / $HOME/.claude/plugins/dev-workflow/agents 回退后得到的 agent 文件路径>`

### 非本地新增问题中断原则

Phase 5 失败根因属于以下任一类型时，**禁止**自动进入"修实现 / 补测试"闭环，必须中断并提示用户：
- 测试环境/配置问题（`${artifactId}`、Nacos secret-key、外部配置缺失）
- 非当前需求变更导致的分支噪音 / 增量覆盖率口径偏移
- 目标应用之外的存量故障
- 基础设施不可用（仓库、网络、权限、外部依赖）

---

## 五、硬约束（测试代码，不可绕过）

1. `test_spec` 是测试代码生成的唯一必须输入
2. 所有生成类放在 `tdd/` 目录
3. **禁止** `@MockBean` 内部组件，仅 Mock 真正的外部系统边界
4. 测试模式固定为 mock-first：JUnit4 + Mockito，HTTP 场景优先 standalone MockMvc，禁止继承任何 Spring 测试基类或连接真实 DB/Redis
5. **禁止**直接 INSERT 数据库
6. 禁止添加 `@Transactional @Rollback`（mock-first 无需事务回滚）
7. **修复轮次内禁止删除测试用例**以强行提高通过率
8. 所有 Code Review 必须且只能通过 `java-review-agent` 执行；禁止任何替代
9. **测试代码只能生成 `.java` 文件**，禁止 `.groovy` / Spock
10. TEST_SPEC 必须遵循 `tdd-test-spec-agent` 的模板，用例预期结果必须包含 `EX1` 起始校验点编号
11. Phase 4 必须严格调度 `testcode-gen-agent`；禁止主会话 freestyle 生成测试代码
12. Phase 5 必须严格调度 `tdd-test-runner-agent`；正式结论以 Runner 返回为准
13. Skill / orchestrator 只允许串流程，不允许代替 Phase Agent 直接生成正式产物
14. 必须严格按 Phase 顺序执行；复杂流程不是跳步或合并步骤的理由
15. Phase 1 正式产物只能是 `test_spec.md`（路径：`{feature_dir}/test_spec.md`）；禁止用 `all_trace.md`、trace 摘要替代
16. Phase 4 未完成前（`test_file_list.md` 未落盘）：禁止 Write/修改工程内 `src/test/**`
17. Phase 3 正式完成必须具备 4 项凭证（缺一视为未真正调度）
18. Phase 4 正式完成必须具备 4 项凭证（缺一视为未真正调度）
19. Phase 5 须由 `tdd-test-runner-agent` 执行；裸 `mvn test` 不能替代 Runner 结论
20. Phase 5 正式完成必须具备 4 项凭证（缺一视为未真正调度 Runner）
21. Phase 3→5 每阶段必须先输出门控行，再 Read + spawn；禁止先改代码再补流程
22. Phase 6 pre-commit 门禁：`git commit` 前必须先通过 Runner 最终跑测；未通过禁止强行提交
23. Phase 5 门禁：未同时满足（通过率 100% **且** 精确增量行覆盖率 ≥80%）时，禁止 `next_phase=phase6`；分支覆盖率低于 80% **不触发**本门禁
