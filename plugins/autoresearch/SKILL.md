---
name: autoresearch-setup
version: v1.0.0
description: 安装 Autoresearch 自主迭代插件，用于场景扩展、多视角预判、架构辩论、调试修复闭环增强。当用户说"安装autoresearch"、"安装自动研究插件"、"autoresearch"时触发。
user-invocable: true
---

# Autoresearch 插件

> `autoresearch` 是一个 **自主迭代 / 调试修复 / 场景扩展 / 多视角分析** 插件，现已纳入主流程必装项。
>
> 推荐关系：
> - `autoresearch`：再回答「下一步该补哪些场景 / 风险 / 修复动作」

---

## 安装命令

优先按 Claude Code 插件方式安装：

```text
/plugin marketplace add https://github.com/uditgoenka/autoresearch
/plugin install autoresearch@autoresearch
```

> ⚠️ `dev-workflow` 主流程当前依赖的是 **`uditgoenka/autoresearch` 的 Claude 插件分发内容**。
> `karpathy/autoresearch` 是 GPU 训练/实验框架，不是 `/autoresearch:scenario` / `/autoresearch:predict` 这套插件命令的等价替代品，不要混淆。

---


### 不冲突，默认互补

- `autoresearch`：做场景扩展、事前多角色分析、主观决策辩论、调试修复和指标驱动迭代

### 推荐顺序

2. 再按阶段需要调用 `autoresearch` 子命令

---

## 在 dev-workflow 中的推荐用法

### 对 `skills/02-implementation-plan`（MODE A）


```text
/autoresearch:scenario
```

推荐用途：

- 扩展边界场景、异常场景、导出测试场景草稿
- 补强 PRD 的 Story / AC / 待确认项

不建议：

- 用它替代 `01-knowledge-base`
- 用它替代 `prd-generator-agent`

### 对 `skills/02-implementation-plan`（MODE B）

适合作为**可选增强**，在正式生成技术方案前辅助分析：

```text
/autoresearch:predict
/autoresearch:reason --domain software
```

推荐用途：

- 技术选型前做多角色预判
- 对架构争议点做对抗式收敛

### 对 `skills/03-code-gen-tdd`

适合作为**可选增强**，在调试 / 修复 / 覆盖率提升阶段使用：

```text
/autoresearch:debug
/autoresearch:fix
/autoresearch
```

推荐用途：

- Phase 5 跑测失败后的问题定位
- 覆盖率或机械指标的迭代提升
- 对某个明确 verify 指标做 bounded loop

不建议：

- 替代 `tdd-test-spec-agent`
- 替代 `java-impl-agent` / `java-review-agent` / `testcode-gen-agent` / `tdd-test-runner-agent`

---

## 安装后检测

可检查全局 `~/.claude/settings.json` 或命令/技能文件是否已就绪：

```bash
if grep -q '"autoresearch@autoresearch"[[:space:]]*:[[:space:]]*true' "$HOME/.claude/settings.json" 2>/dev/null \
  || { [ -f "$HOME/.claude/commands/autoresearch.md" ] && [ -d "$HOME/.claude/skills/autoresearch" ]; }; then
  echo "AUTORESEARCH_OK"
else
  echo "AUTORESEARCH_MISSING"
fi
```

---

## 结论

- 更适合作为 `02/03/04` 阶段的**可选增强插件**
