# Stage 02-implementation-plan — 输入示例

## 用户输入（跨域需求，5 个应用）

```
/02-implementation-plan

mrd：https://your-domain.feishu.cn/wiki/LH6xwatvgiOktWkrQDjclb7nnDh

履约域：
/path/to/your-app
/path/to/your-app
运配域：
/path/to/your-app
/path/to/your-app
/path/to/your-app
```

## 参数说明

| 参数 | 是否必填 | 说明 |
|---|---|---|
| `mrd：<飞书链接>` | 必填 | MRD 飞书文档 URL |
| `<域名>：` + 项目路径列表 | 必填（至少一个域） | 每行一个本地工程路径，按领域分组 |

## 说明

Agent 自动完成：
1. **需求归属**：app-router-agent 识别涉及的应用和领域
2. **需求澄清**：mrd-clarify-agent 读取 MRD，对照知识库提问，生成 `mrd-clarified.md`
3. **生成 PRD**：prd-generator-agent 按领域分别生成 PRD（本例生成履约域 + 运配域两份 PRD）
4. **生成技术方案**：tech-design-agent 按应用分别生成技术方案（本例生成 5 份技术方案）
5. **上传飞书**：所有文档自动上传至飞书并返回链接

## 产出文件（存放在需求空间 `req/<需求名>/`）

```
req/当面开箱拍照签收/
├── mrd-clarified.md      ← MRD 澄清版（见 mrd-clarified.md 示例）
├── prd.md                ← 运配域 PRD（见 prd.md 示例）
└── tech-design.md        ← carrier 应用技术方案（见 tech-design.md 示例）
```
