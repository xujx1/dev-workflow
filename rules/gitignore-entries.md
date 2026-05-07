# dev-workflow .gitignore 条目清单

> 由 `/dev-workflow:00-init` Step 5 读取，自动追加到业务项目工程的 `.gitignore`。
> 只追加缺失条目，不覆盖已有内容。

---

## 必须忽略的条目

### 个人环境配置（所有项目，无条件追加）

```
# dev-workflow 个人环境配置（不同开发者插件安装状态不同，不入仓库）
/.mrd-to-code-config.json
.gitnexus
```

### L3 GitNexus 索引（安装 GitNexus 时追加）

```
# GitNexus 代码调用链索引（本地生成，体积大，不入仓库）
/.gitnexus/
```

### 需求过程产物（参考条目，不自动追加）

```
# dev-workflow 需求研发过程产物（如不入仓库按需手动启用）
# /req/
```

---

## 安装触发规则

| 条目 | 触发时机 |
|------|---------|
| `/.mrd-to-code-config.json` | 始终追加（Step 5 无条件执行） |
| `/.gitnexus/` | 仅当 L3 GitNexus 安装成功时追加 |
| `/req/` | 不自动追加，注释形式供团队参考 |
