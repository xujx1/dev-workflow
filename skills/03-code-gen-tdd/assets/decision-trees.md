# 决策树 — 03-code-gen-tdd

## 一、Phase 5 诊断决策树

> ⚠️ Token 优化约束（P0）：Phase 5 未达标时，**本轮只输出诊断结论并落盘**，禁止自动跨 Phase 回溯；等待下一轮 `--resume` 从 Phase 2 或 Phase 4 开始修复。

```
测试未达标
│
├─ 测试失败（FAILURE / ERROR）
│     │
│     ├─ 根因是环境/配置/存量问题（${artifactId}、secret-key、仓库依赖）
│     │     → 直接中断并提示用户，禁止自动修复
│     │
│     └─ 断言失败 / NPE / 数据初始化 / 编译错误（本地新增问题）
│           → 本轮只输出诊断结论并落盘：
│             - phase5_dod_met=false
│             - next_phase=phase2（或 phase4，按诊断）
│             - test_retry_count++（立即递增）
│             - 过程数据：失败用例清单、异常堆栈摘要、根因分类
│             → 提示用户下一轮 --resume 从 Phase 2 或 Phase 4 修复
│
└─ 覆盖率不足（精确增量行覆盖率 <80%，通过率 = 100%）
      │
      ├─ 增量口径无法准确映射（分支噪音、变更清单缺失）
      │     → 直接中断并提示用户
      │
      ├─ 行覆盖 <80%
      │     → 本轮只输出诊断结论并落盘：
      │       - phase5_dod_met=false
      │       - next_phase=phase2
      │       - coverage_retry_count++（立即递增）
      │       - 过程数据：未覆盖方法摘要、覆盖率报告路径
      │       → 提示用户下一轮 --resume 从 Phase 2 补充模式开始
      │
      └─ 未覆盖路径是「死代码」
            → 标注 [待确认]，不强制覆盖
```

---

## 二、Phase 5 达标标准

| 指标 | 目标 | 说明 |
|------|------|------|
| 精确增量**行**覆盖率 | ≥ 80% | **唯一门槛**，决定 `phase5_dod_met` |
| 测试通过率 | 100%（0 失败，0 错误）| 必须满足，否则不进覆盖率评判 |
| 精确增量**分支**覆盖率 | 诊断参考，**不作为门槛** | 低于 80% **不触发** DoD 失败 |
| 全量覆盖率 | 诊断参考，**不作为门槛** | 仅用于辅助定位 |

> ⚠️ **硬约束**：`phase5_dod_met=true` 的判定条件是「测试通过率 100% **且** 精确增量**行**覆盖率 ≥80%」。若 Runner 报告中出现"分支覆盖率低于阈值"的 DoD 失败判定，视为执行错误，必须以行覆盖率重新判断。

---

## 三、修复优先级（Phase 5 失败时）

1. **先修代码，后改测试**：测试断言失败时，默认假设代码有问题而非测试目标错误
2. **测试可修改的场景**：Mock 数据配置错误、测试入口调用链写错
3. **代码可修改的场景**：逻辑 Bug、边界处理缺失、异常未处理

---

## 四、恢复轮次上限

| 轮次 | 回溯路径 A（测试失败）| 回溯路径 B（覆盖率不足）|
|------|----------------------|------------------------|
| 第 1 轮 | Phase 2(fix) → Phase 4(fix) → Phase 5 | Phase 2(supplement) → Phase 4(supplement) → Phase 5 |
| 第 2 轮 | 同上 | 同上 |
| 第 3 轮 | 同上；仍未达标 → 输出诊断报告，请求人工介入 | 同上；仍未达标 → 输出诊断报告，请求人工介入 |

> ⚠️ **retry_count 门禁**：`test_retry_count >= 3` 或 `coverage_retry_count >= 3` 时，**禁止**自动再次回溯，必须输出结构化诊断报告（失败根因 + 已排除可能 + 建议人工操作项），请求人工介入。

---

## 四-B、Phase 5 失败根因分流路由

> 在输出诊断结论前，orchestrator 必须先完成根因分类，决定回溯路径。

```
Phase 5 失败
│
├─ 根因属于「外部/环境」类（禁止自动修复，直接中断）
│     - 测试环境配置问题（${artifactId}、Nacos、secret-key）
│     - 仓库/网络/权限不可用
│     - 目标应用之外的存量故障
│     → 输出中断提示，说明具体原因，等待用户处理
│
├─ 根因属于「实现 Bug」类（回溯 Phase 2）
│     - 断言失败 → 代码逻辑错误
│     - NPE → 边界条件未处理
│     - 覆盖率不足 → 未覆盖新增分支
│     → test_retry_count++ 或 coverage_retry_count++
│     → 读取 impl_context_snapshot.md 作为修复上下文基线
│     → 落盘诊断后等待下一轮 --resume 从 Phase 2(fix) 起
│
├─ 根因属于「测试代码」类（回溯 Phase 4）
│     - Mock 数据配置错误
│     - 测试入口调用链写错（非实现问题）
│     → test_retry_count++
│     → 落盘诊断后等待下一轮 --resume 从 Phase 4(fix) 起
│
└─ 根因无法确定（降级处理）
      → 默认走「实现 Bug」分支（从 Phase 2 回溯）
      → 在诊断报告中注明"根因不确定，保守回溯"
```

---

## 五、Phase 节奏决策

| 节点 | 决策 |
|------|------|
| Phase 0 完成 | → Phase 1（立即） |
| Phase 1 完成（确认门通过） | → Phase 2（停下汇报后继续） |
| Phase 2 完成 | → Phase 3（可连续，最多 2 个 Phase）；Phase 3 后停下汇报 |
| Phase 3 PASS/WARN | → Phase 4（停下汇报）|
| Phase 3 BLOCK | → **orchestrator 接管**：读 impl_context_snapshot.md → spawn java-impl-agent(fix)（最多 3 轮）；仍 BLOCK → 中断 |
| Phase 4 完成 | → Phase 5（停下汇报）|
| Phase 5 达标 | → Phase 6（停下汇报，等用户确认）|
| Phase 5 未达标 | → 落盘诊断，等待下一轮 --resume |

---

## 六、过程数据落盘规范

**写入位置**：`{feature_dir}/execution-state.md` 「过程数据」下对应小节。

**必须落盘的字段（每 Phase 完成时）**：

| 字段 | 说明 |
|------|------|
| `mode` | `full` / `tech-only` |
| `last_completed_phase` | 刚完成的 Phase |
| `next_phase` | 下一待执行 Phase |
| `awaiting_user_confirmation_for` | 等待确认的 Phase；无等待写 `none` |
| `phase_gate_status` | `pending` / `confirmed` / `not_applicable` |
| `phase5_dod_met` | Phase 5 后写入：`true` / `false` |
| `test_retry_count` | 整数，初始 0；测试失败自动修复时 +1；达 3 停止自动重试 |
| `coverage_retry_count` | 整数，初始 0；覆盖率补救时 +1；达 3 停止 |
| `consecutive_phases_count` | 连续执行的 Phase 数；≥2 时强制停下汇报 |

**附加要求**：
- Phase 2 结束后必须写入 **Phase 2 变更清单**（`{feature_dir}/state/change-manifest-phase2.md`），禁止只依赖临时 `git diff HEAD`
- 命中摘要（`execution-state.md`「命中摘要（按环节）」）每 Phase 完成后立即更新；禁止留到归档阶段补
- `last_completed_phase=phase4` 时，`next_phase` **必须**写 `phase5`（硬约束），禁止标注「可选」
