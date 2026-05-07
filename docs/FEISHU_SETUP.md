# 飞书集成配置指南

> 飞书集成是**完全可选**的。不配置时，所有文档仅保存在本地，不影响核心功能（知识库构建、代码生成、单测）。

---

## 飞书集成能做什么

| 功能 | 说明 |
|------|------|
| 读取 MRD | 直接传入飞书文档 URL，Agent 自动读取内容 |
| 上传 PRD | PRD 生成后自动上传到你的飞书 Wiki |
| 上传技术方案 | 技术方案上传飞书，便于团队协作评审 |
| 上传归档报告 | 需求归档报告上传飞书留存 |

---

## 前置条件

1. 拥有飞书企业账号（自建或企业版均可）
2. 创建一个飞书自建应用，获取 App ID 和 App Secret
3. 为应用开通以下权限：
   - `docx:document:read`
   - `docx:document:create`
   - `wiki:wiki:read`
   - `wiki:wiki:create`

---

## 配置步骤

### 1. 创建飞书自建应用

1. 进入 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 记录 `App ID` 和 `App Secret`

### 2. 配置 MCP 服务器

编辑 `mcp-configs/mcp-servers.json`，填入你的飞书应用信息：

```json
{
  "mcpServers": {
    "feishu": {
      "command": "npx",
      "args": ["-y", "mcp-feishu"],
      "env": {
        "FEISHU_APP_ID": "your_app_id_here",
        "FEISHU_APP_SECRET": "your_app_secret_here"
      }
    }
  }
}
```

将此配置复制到 Claude Code 的 MCP 配置文件（通常是 `~/.claude/mcp.json`）。

### 3. 配置飞书 Wiki 根目录（可选）

如需将产物上传到指定的 Wiki 空间，在 `.mrd-to-code-config.json` 中添加：

```json
{
  "feishu": {
    "wiki_root_url": "https://your-domain.feishu.cn/wiki/your-wiki-id"
  }
}
```

不配置时，文档上传到你的飞书个人空间根目录。

---

## 使用方式

配置完成后，执行命令时可以直接传入飞书 URL：

```
/dev-workflow:02-implementation-plan

mrd：https://your-domain.feishu.cn/wiki/your-mrd-id
```

Agent 会自动调用飞书 MCP 读取文档内容。

---

## 不使用飞书时的替代方案

**传入本地文件路径**（替代飞书 MRD 读取）：

```
/dev-workflow:02-implementation-plan

mrd：/path/to/your-mrd.md
```

**手动管理文档**：PRD、技术方案、归档报告默认保存在 `req/{feature-name}/` 目录下，可自行上传或共享。

---

## 常见问题

**Q：飞书应用权限不够怎么办？**

在飞书开放平台的应用管理页，进入「权限管理」补充缺失的权限，然后重新发布应用版本。

**Q：上传飞书失败，但不想中断流程怎么办？**

上传失败不会阻断主流程，文档会保留在本地。可以后续手动上传，或忽略（飞书上传是非核心步骤）。

**Q：使用的是飞书私有部署版本怎么配置？**

将 MCP 配置中的域名从 `open.feishu.cn` 替换为你的私有部署地址，`FEISHU_DOMAIN` 环境变量也需要同步修改。
