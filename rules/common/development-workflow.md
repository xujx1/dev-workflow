# 开发工作流

## 功能实现标准流程

```
0. 知识库加载 → 读 app-knowledge-base/_index.md
1. 规划        → planner Agent 制定实现方案
2. TDD 规格    → `tdd-test-spec-agent` 先生成正式 `test_spec`
3. 编码实现    → `java-impl-agent`
4. Code Review → `java-review-agent`
5. 测试代码    → `testcode-gen-agent`
6. 跑测验收    → `tdd-test-runner-agent`
7. git commit  → 提交（pre-commit 钩子自动触发）
```

---

## Skill 编排执行规则（硬约束）

当工作流由 Skill 触发时，必须遵守以下规则：

1. **严格按 Skill 中声明的步骤 / Phase 顺序执行**，不得自行重排。
2. Skill 只负责：
   - pre-check
   - spawn 对应 Agent
   - 等待 Agent 完成
   - 校验产物落盘
   - 展示确认门
   - 更新状态文件
3. Skill **不得直接生成**已分配给 Agent 的正式产物正文。
4. 若某一步声明为 `tdd-test-spec-agent` / `java-impl-agent` / `java-review-agent` / `testcode-gen-agent` / `tdd-test-runner-agent` 执行，则必须由该 Agent 落盘对应文件。
5. 复杂流程不得降级为“凭上下文一次性生成整包产物”；必须保留分阶段执行与阶段间等待。

---

## MRD to Code 全流程

当用户提供 MRD 飞书地址时，启动 **mrd-to-code-v2** 技能：

```
Stage 0: MRD 澄清     → 确认门 0
Stage 1: PRD 生成     → 确认门 1
Stage 2: 技术方案     → 确认门 2
Stage 3: 代码生成     → 确认门 3（自动触发 test-spec）
Stage 4: 归档         → 手动触发
```

每阶段通过 Task 工具以独立子代理执行，保证上下文隔离。

---

## 上下文管理

**避免在上下文窗口最后 20% 执行**：
- 大规模重构
- 跨多文件功能实现
- 复杂 Bug 调试

**低上下文依赖任务**（可在任意位置执行）：
- 单文件编辑
- 文档更新
- 简单 Bug 修复

**上下文中断恢复**：
- 读取 `{feature_dir}/execution-state.md` 恢复执行状态
- 关键变量通过状态文件传递，不依赖对话历史

---

## 模型选择策略

| 阶段/场景 | 模型 | 理由 |
|-----------|------|------|
| MRD 澄清、PRD 生成 | `sonnet` | 文档结构化 |
| 技术方案设计 | `sonnet`（可升 `opus`）| 复杂推理 |
| 代码生成 | `sonnet` | 最佳编码模型 |
| 知识库整理、归档 | `haiku` | 轻量整理，节省成本 |
| 架构决策、深度分析 | `opus` | 最强推理能力 |
