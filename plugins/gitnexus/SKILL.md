---
name: gitnexus
version: v1.0.0
description: 安装 GitNexus 代码调用链分析插件。基于 AST 本地索引，为 Claude Code 提供实时语义查询（gitnexus_get_callers、impact 分析）。在 Phase 3 Code Review 阶段提供精准影响面分析。当用户说"安装gitnexus"、"代码调用链分析"、"影响面分析"时触发。
user-invocable: true
layer: L3
---

# GitNexus — 代码调用链分析插件

> **定位**：L3 结构分析层，现已纳入主流程必装项。
> - GitNexus：MCP 实时查询调用链 / 影响面（主流程自动调用，供 Code Review / 技术方案阶段使用）
>
> **隐私安全**：代码永不出本地，索引存于 `.gitnexus/` 目录。

---

## Step 1：安装 GitNexus 插件

```bash
/plugin marketplace add https://github.com/abhigyanpatwari/GitNexus
/plugin install gitnexus@gitnexus-marketplace
```

Cursor / 本地 fallback 可直接走官方 CLI + MCP：

```bash
npm install -g gitnexus

# 在目标工程根目录执行
gitnexus analyze .

# 向 {project_root}/.claude/settings.json 合并写入：
# {
#   "mcpServers": {
#     "gitnexus": {
#       "command": "npx",
#       "args": ["-y", "gitnexus@latest", "mcp"]
#     }
#   }
# }
```

> ⚠️ `dev-workflow` 主流程当前识别的是 **GitNexus CLI + 项目索引 + 项目级 MCP 注册** 这三件套。
> 仅执行 `git clone https://github.com/abhigyanpatwari/GitNexus.git && npm install && npm run dev`
> **不能保证**得到当前主流程需要的 `gitnexus` CLI、`.gitnexus/` 索引目录和 `.claude/settings.json` MCP 配置，
> 因此**不要**把 `npm run dev` 当作 preflight 的主 fallback。
> `runtime_env=cursor_like` 时，应优先执行上面的 npm/npx 官方 CLI 链路。

---

## Step 2：初始化本地代码索引

在**目标业务工程根目录**执行（AST 解析，建立调用关系图，结果写入 `.gitnexus/`）：

```bash
cd {project_root}
gitnexus analyze .
```

> 首次构建时间视工程规模而定（通常 30s-5min）。后续增量更新：
> ```bash
> gitnexus analyze .           # GitNexus 会自动做增量刷新
> ```

> ⚠️ `.gitnexus/` 目录为本地 AST 索引缓存，**不应提交到版本库**。
> 请确保目标工程 `.gitignore` 中已添加：
> ```
> /.gitnexus/
> ```
> `dev-workflow` 仓库自身的 `.gitignore` 已包含此条目。

---

## Step 3：注册 MCP Server

将 GitNexus MCP 写入项目级配置（`.claude/settings.json`）：

```bash
# 推荐写法：使用 npx 固定命令入口，避免 PATH 差异
```

等效于在 `.claude/settings.json` 中追加：

```json
{
  "mcpServers": {
    "gitnexus": {
    "command": "npx",
      "args": ["-y", "gitnexus@latest", "mcp"]
    }
  }
}
```

---

## Step 4：验证安装

```bash
# 验证 MCP 工具可用
gitnexus status

# 验证索引目录已生成
test -d .gitnexus && echo "GITNEXUS_INDEXED"
```

Claude Code 中验证：直接询问"查询 {方法名} 的调用链"，若返回调用点列表则安装成功。

---

## 可用 MCP 工具（安装后 Claude 可直接调用）

| 工具 | 说明 | 典型使用场景 |
|------|------|------------|
| `gitnexus_get_callers(method)` | 查询方法的所有调用点 | Phase 3 Review：确认修改影响哪些上游 |
| `gitnexus_get_callees(method)` | 查询方法调用的所有下游方法 | 技术方案：评估接口改动的传播链 |
| `gitnexus_impact(class_or_method)` | 分析修改后的影响范围（调用链 + 测试覆盖） | 修改公共工具类前的安全评估 |
| `gitnexus_search(keyword)` | 语义搜索代码实体 | 知识库补充、快速定位实现 |
| `gitnexus_path(from, to)` | 查询两个实体间的调用路径 | 追踪复杂调用链 |

---

## 与 dev-workflow 的集成点

| 阶段 | 集成方式 |
|------|---------|
| Phase 3 Code Review | `java-review-agent` 自动调用 `gitnexus_get_callers` 获取影响点，注入 Review 上下文 |
| 技术方案（`03-tech-design`） | `tech-design-agent` 调用 `gitnexus_impact` 生成"变更影响分析"附录 |
| 前置检查 | `project-preflight` 检测 GitNexus MCP 状态，返回 `l3_gitnexus` 字段 |

---

## 卸载

```bash
gitnexus mcp uninstall --scope project
rm -rf .gitnexus/
```
