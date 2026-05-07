# 知识库梳理验证检查

## 自动检查（子代理执行）

### 应用知识库（app-knowledge-agent）
- [ ] `app-knowledge-base/CONTEXT.md` 存在且 ≤ 200行
- [ ] `app-knowledge-base/KB_FRESHNESS.md` 存在（记录更新时间和保鲜状态）
- [ ] `app-knowledge-base/api-index.md` 存在且 ≤ 150行
- [ ] `app-knowledge-base/KB_INDEX.md` 存在且 ≤ 100行（mode=lite）
- [ ] `app-knowledge-base/component-index.md` 存在（mode=lite）
- [ ] `app-knowledge-base/01_业务与领域知识层.md` 存在（mode=lite）
- [ ] `app-knowledge-base/02_架构与设计层.md` 存在（mode=lite）
- [ ] `app-knowledge-base/03_核心流程与逻辑层.md` 存在（mode=lite）
- [ ] 各章节文件非空（不含占位文本）
- [ ] 所有章节中无 ASCII art（`├──`、`└──` 等字符）

### 一致性（mode=lite 时）
- [ ] `01_业务与领域知识层.md` 的核心实体与 `CONTEXT.md` 实体列表对齐

## 需人工确认（确认门0）

- [ ] 应用知识库的核心流程描述是否准确反映实际代码逻辑
- [ ] 知识库术语是否与产品/业务方对齐

## 验证未覆盖

- 知识库内容的业务准确性（需业务方 review）