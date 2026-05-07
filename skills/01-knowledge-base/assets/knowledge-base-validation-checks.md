# 知识库梳理验证检查

## 自动检查（子代理执行）

### 应用知识库（app-knowledge-agent）
- [ ] `app-knowledge-base/CONTEXT.md` 存在且 ≤ 200行
- [ ] `app-knowledge-base/api-index.md` 存在且 ≤ 150行
- [ ] `app-knowledge-base/01_业务与领域知识层.md` 存在（mode=lite）
- [ ] `app-knowledge-base/02_架构与设计层.md` 存在（mode=lite）
- [ ] `app-knowledge-base/03_核心流程与逻辑层.md` 存在（mode=lite）
- [ ] 各章节文件非空（不含占位文本）
- [ ] 所有章节中无 ASCII art（`├──`、`└──` 等字符）
- [ ] ⚠️ api-docs/ 目录检查已移除（默认不生成，autoresearch 按需替代）

### 业务知识库（biz-knowledge-agent，mode=lite 默认）
- [ ] `app-knowledge-base/biz-knowledge/prd-context/_index.md` 存在且非空
- [ ] `_index.md` 包含业务术语表
- [ ] ⚠️ B0/B1/B2 文件不在默认检查范围（显式要求才生成）

### 测试知识库（test-knowledge-agent，仅显式请求时触发）
- [ ] 默认不检查（test-knowledge-agent 默认不 spawn）
- [ ] 如已生成：`app-knowledge-base/test-knowledge/modules/README.md` 存在
- [ ] 如已生成：`app-knowledge-base/test-knowledge/modules/` 下至少有 1 个模块测试知识库文件

### 三库一致性（mode=lite 时）
- [ ] `01_业务与领域知识层.md` 的核心实体与 `biz-knowledge/prd-context/_index.md` 术语表对齐
- [ ] ⚠️ test-knowledge 一致性检查已移除（默认不生成）

## 需人工确认（确认门0）

- [ ] 应用知识库的核心流程描述是否准确反映实际代码逻辑
- [ ] 业务知识库的术语是否与产品/业务方对齐
- [ ] 测试知识库的业务场景覆盖是否充分

## 验证未覆盖

- 知识库内容的业务准确性（需业务方 review）
- api-docs 接口文档的完整性（依赖接口数量和 APM 数据）
