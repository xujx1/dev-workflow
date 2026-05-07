# GitNexus 调用链影响分析步骤

> 本节仅在 `l3_gitnexus=available` 时执行，在 BLOCKER 扫描（L0）之前完成。
> 目标：在技术方案附录II已给出的影响面背景之上，精确补充"实现后新增变化"的上游影响点。
> 若 `tech-design.md` 中已有附录II，本节应先复用该结论，再仅对本次实际 diff 新增/变更的公开方法做增量核验。
> 禁止在 Review 阶段重新执行一遍面向候选改动实体的全量 `gitnexus_impact` 梳理。

## Step G1：获取本次变更的公共方法列表

从 Phase 2 变更清单或 `git diff HEAD~1 HEAD` 中提取：
- 所有新增或修改的 `public` / `protected` 方法签名
- 所有修改的接口方法签名

若 `tech-design.md` 的附录II已覆盖其中部分实体，则只对附录II未覆盖、或实现后签名/调用边界发生变化的实体继续做 GitNexus 增量查询。

## Step G2：查询调用链

对 Step G1 中每个方法签名，调用：

```
gitnexus_get_callers("{方法全限定签名}")
```

汇总结果格式：
```
调用链影响分析：
  方法 A → 被 N 处调用：
    - {调用点1：类名:行号}
  方法 B → 被 M 处调用：
    ...
```

## Step G3：影响面评估

| 检查项 | 说明 |
|--------|------|
| 跨模块调用 | 影响点是否跨越 Service / Controller / 外部模块边界 |
| Breaking Change | 修改的方法签名是否导致调用方编译失败风险 |
| 事务边界穿越 | 调用链中是否存在事务方法调用非事务修改方法 |
| 测试覆盖缺口 | 影响点是否有对应测试，若无则标记为 L1 警告 |

## Step G4：写入 Review 报告

在 `{feature_dir}/code-review.md` 中新增节：

```markdown
## 调用链影响分析（GitNexus）

背景输入：已读取 `tech-design.md` 附录II（若存在）

| 修改方法 | 调用点数量 | 跨模块 | Breaking Change 风险 |
|---------|----------|-------|-------------------|
| {方法A} | {N} | 是/否 | 低/中/高 |

影响摘要：{1-2句总结}
```
