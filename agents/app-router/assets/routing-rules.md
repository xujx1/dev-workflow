# 路由规则详情

## 提取信号（Step 2，按优先级）

| 信号类型 | 示例 | 对应应用 |
|----------|------|----------|
| 明确提到应用名 | "carrier-integrator 需要..." | 直接匹配 |
| 提到领域/模块名 | "BCP 加时接口" | 查 domain_registry 找对应 app |
| 提到接口路径/前缀 | "/tms/carrier/..." | 查 service_registry 找对应 app |
| 提到数据表/消息 | "oms_order 表" | 推断负责该表的 app |

## 决策路由类型（Step 3）

| 情况 | 路由类型 | 处理方式 |
|------|----------|----------|
| 只识别到 1 个应用 | **单应用直通** | feature_dir 不分级，直接输出 apps.json（1项） |
| 识别到 2+ 个应用 | **多应用拆分** | feature_dir 下创建子目录 `{app-name}/`，各子目录独立运行后续 Stage |
| 无法识别（注册表缺失） | **手动确认** | 输出应用候选列表，等待用户选择 |

## apps.json 格式（Step 4）

**单应用**：
```json
{
  "routing_type": "single",
  "apps": [
    {
      "name": "your-app-name",
      "repo_path": "/path/to/your-app",
      "kb_path": "/path/to/your-app/app-knowledge-base",
      "feature_subdir": "req/{feature}",
      "role": "primary"
    }
  ]
}
```

**多应用**：
```json
{
  "routing_type": "multi",
  "apps": [
    {
      "name": "your-app-name",
      "repo_path": "/path/to/your-app",
      "kb_path": "/path/to/your-app/app-knowledge-base",
      "feature_subdir": "req/{feature}/your-app-name",
      "role": "primary",
      "responsibility": "应履约时间计算逻辑"
    },
    {
      "name": "your-app-name-2",
      "repo_path": "/path/to/your-app",
      "kb_path": "/path/to/your-app/app-knowledge-base",
      "feature_subdir": "req/{feature}/your-app-name-2",
      "role": "secondary",
      "responsibility": "调度中心接口适配"
    }
  ],
  "cross_app_contracts": [
    {
      "from": "your-app-name",
      "to": "your-app-name-2",
      "interface": "BCP 加时接口",
      "type": "dubbo"
    }
  ]
}
```

## 多应用 Stage 调度规则

| 阶段 | 单应用 | 多应用 |
|------|--------|--------|
| Stage 1 PRD | 1 个 prd-generator-agent | N 个 prd-generator-agent 并行（主应用先完成后副应用参考） |
| Stage 2 Tech | 1 套 tech-design + test_spec | N 套 tech-design + test_spec（cross-app-interface.md 作为共享输入）|
| Stage 3 Code | 1 套 code-gen + testcode-gen | N 套独立执行，按接口契约对齐 |
| Stage 2.5 OpenSpec | 1 个 spec 目录 | 共享 1 个 spec 目录，包含所有跨应用接口 |

## 错误处理

| 情况 | 处理方式 |
|------|----------|
| domain_registry 不存在 | 提示用户先运行知识库梳理，或手动指定应用列表 |
| 应用识别置信度 < 80% | 输出候选列表（附置信度），等待用户确认 |
| repo_path 不存在 | 警告并继续，标记该应用为"仅文档，无本地代码" |
