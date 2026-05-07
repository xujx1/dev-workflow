# Git 工作流

## 提交消息格式

```
<type>: <description>

<optional body>
```

**类型**：`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

**示例**：
```
feat: 新增用户积分扣减接口

- 支持多种扣减场景（下单/退款/活动）
- 接入分布式锁防并发超扣
- 写入本地消息表保证 MQ 可靠发送
```

---

## 提交前检查清单

在执行 `git commit` 前，确认：

- [ ] 所有 B1-B10 BLOCKER 项已通过（见 `rules/java/code-quality.md`）
- [ ] 无硬编码密钥/密码/Token（B8）
- [ ] `mvn compile` 通过，无编译错误
- [ ] 空 catch 块已处理（B9）

---

## Pull Request 工作流

创建 PR 时：

1. 分析从分叉点到 HEAD 的完整提交历史（非仅最新 commit）
2. 运行 `git diff [base-branch]...HEAD` 查看全量变更
3. 撰写全面的 PR 摘要（背景 + 方案 + 影响范围）
4. 包含测试计划 TODO 清单
5. 新分支使用 `-u` 标志推送

---

## Diff 输出规范

所有 `git diff` / `git show` / `git log -p` 场景默认遵循以下规则，避免卡在分页器：

1. 默认禁用 pager：
   - `git --no-pager diff ...`
   - `git --no-pager show ...`
   - `git --no-pager log -p ...`
2. 若输出过大，优先先取文件清单，再逐文件读取：
   - `git --no-pager diff --name-only ...`
   - 再对单文件执行 `git --no-pager diff ... -- path/to/File.java`
3. 禁止依赖交互式分页器输出结果
4. 若完整 diff 未正常吐出内容，必须自动降级为“禁用 pager + 逐文件 diff”策略

---

## 分支命名规范

```
feature/{feature-name}     # 新功能
fix/{bug-name}             # Bug 修复
hotfix/{issue}             # 线上紧急修复
refactor/{module}          # 重构
chore/{task}               # 杂项（依赖升级、配置调整）
```
