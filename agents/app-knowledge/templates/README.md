# 知识库模版说明

本目录存放三类知识库的标准模版，供梳理知识库时参照。

## 使用说明

| 模版文件 | 对应知识库 | 使用场景 |
|---------|-----------|---------|
| [app-kb-template.md](app-kb-template.md) | 应用知识库（00_概览.md + 六大分层文档） | 梳理一个新服务的全量知识库时，以本模版生成 00_概览.md |
| [biz-module-template.md](biz-module-template.md) | 业务知识库（biz-knowledge/modules/） | 为每个业务模块生成一份知识文档时使用 |
| [test-module-template.md](test-module-template.md) | 测试知识库（api-testcase/） | 为每个接口生成测试用例文档时使用 |

## 模版设计原则

1. **轻量优先**：模版只保留 Agent 生成代码必须知道的内容；详细说明放子文档，通过索引引用
2. **规则直写**：业务规则直接写在模版里，不引用外部文档；Agent 加载时能立刻获取
3. **可验证字段**：每个字段都有明确的填写范例，禁止"待补充"占位
4. **大小控制**：
   - `app-kb-template.md`（00_概览.md）填完后目标 ≤200 行
   - `biz-module-template.md` 填完后目标 ≤150 行
   - `test-module-template.md` 填完后目标 ≤100 行
