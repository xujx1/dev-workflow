# 多域路由 Agent — 执行步骤与路由逻辑

## 输入

| 参数 | 必须 | 说明 |
|------|------|------|
| `mrd_local_path` | 是 | 本地 MRD 文件路径 |
| `feature_name` | 是 | 需求名称（用于构造 feature_abs_path） |
| `apps` | 否 | 用户直传应用路径列表（逗号分隔绝对路径）；提供时跳过 app-router 探测 |
| `domain_registry_path` | 否 | 默认 `{any_app}/app-knowledge-base/domain_registry.json` |
| `service_registry_path` | 否 | 默认 `{any_app}/app-knowledge-base/service_registry.json` |

## 执行步骤

### Step 1：判断路由模式

- `apps` 参数已提供 → **直传模式**，跳转 Step 2-A
- `apps` 参数未提供 → **自动探测模式**，跳转 Step 2-B

### Step 2-A：直传模式（用户已明确提供应用列表）

1. 解析 `apps` 逗号分隔的绝对路径列表
2. 读取 MRD 或由 orchestrator 传入的 `domains[]` 结构，将 apps 分配到各域
3. 若 domains[] 不可用，将所有 apps 归入单一默认域，询问用户按域归类
4. 跳转 Step 3（补写 feature_abs_path）

### Step 2-B：自动探测模式（spawn app-router-agent）

⚠️ 严格阻塞等待 app-router-agent 返回后才继续。

调用参数：
- `mrd_content`：读取 `mrd_local_path` 全文
- `feature_dir`：任意 app 的 `req/{feature_name}/` 目录
- `domain_registry_path` / `service_registry_path`：透传

app-router-agent 返回 `apps.json` 后：
- 提取 `apps[]`（含 `repo_path`、`role`、`responsibility`）
- 提取 `cross_app_contracts[]`（若有）
- 提取或推断 `domains[]`（按 domain_registry 分组）

### Step 3：补写 feature_abs_path

对 `apps[]` 中每个 app，追加字段：

```
feature_abs_path = {app.repo_path}/req/{feature_name}
```

⚠️ feature_abs_path 中不含 domain 层级，各 app 目录平铺，不嵌套。

### Step 4：展示确认门（阻塞）

输出以下格式，**严格阻塞等待用户回复"确认"**：

```
已识别 {N} 个业务域，请确认需求归属（可调整后回复"确认"）：

【{域名A}】
  - {app1}  路径：{feature_abs_path_1}  角色：主
  - {app2}  路径：{feature_abs_path_2}  角色：副

【{域名B}】
  - {app3}  路径：{feature_abs_path_3}  角色：主
  - {app4}  路径：{feature_abs_path_4}  角色：副
  - {app5}  路径：{feature_abs_path_5}  角色：副

{跨域接口契约（若有）：}
  - {app1} → {app3}：{接口描述}（{类型}）

如需调整域归属，请回复"将 {app} 移至 {域}"；
确认无误请回复"确认"。
```

### Step 5：用户确认后创建目录并写入 apps.json

用户回复"确认"后执行：

1. 为每个 app 创建 feature_abs_path 目录：
   ```bash
   mkdir -p {feature_abs_path}
   ```

2. 将增强后的路由结构写入每个 app 的 `{feature_abs_path}/apps.json`：
   ```json
   {
     "routing_type": "multi",
     "feature_name": "{feature_name}",
     "domains": [
       {
         "name": "{域名A}",
         "display_name": "{展示名}",
         "apps": ["app1", "app2"]
       }
     ],
     "apps": [
       {
         "name": "app1",
         "repo_path": "...",
         "kb_path": "...",
         "feature_abs_path": "...",
         "domain": "{域名A}",
         "role": "primary",
         "responsibility": "..."
       }
     ],
     "cross_app_contracts": []
   }
   ```

3. 如存在 cross_app_contracts，同时写入 `{任意app feature_abs_path}/cross-app-interface.md`。

## 输出（返回给 orchestrator）

| 字段 | 说明 |
|------|------|
| `apps_with_paths` | 包含 feature_abs_path 的增强 apps 列表 |
| `domains` | 域列表（含各域所属 apps） |
| `cross_app_contracts` | 跨应用接口契约（无则空数组） |
| `confirmed` | true（用户已回复"确认"） |

## 错误处理

| 情况 | 处理 |
|------|------|
| app-router-agent 返回空 apps[] | 提示用户手动指定，使用直传模式 fallback |
| repo_path 不存在 | 警告标注"无本地代码"，继续流程 |
| 用户调整域归属 | 重新渲染确认门，等待再次"确认" |
| feature_name 未提供 | 从 mrd_local_path 提取需求目录名作为 fallback |
