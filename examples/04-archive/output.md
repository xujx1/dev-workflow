# Stage 04-archive — 产出说明

## 产出文件

### `archive-report.md` — 需求归档报告

> 示例见：[archive-report.md](./archive-report.md)

archive-report-agent 在归档阶段自动生成，包含 6 个节的完整需求跟踪数据，同步上传至飞书。

飞书原文：https://your-domain.feishu.cn/wiki/BcIawkm3OikY8Xkg8IQcL1mdnWd

---

## 报告结构（6 节）

| 节 | 内容 | 本案例数值 |
|---|---|---|
| 节1：MRD 标准度 | 6 维度综合打分（满分 100） | **78 / 100** |
| 节2：AI PRD 功能覆盖度 | 对比飞书最新 PRD，逐功能点比对 | **91%** |
| 节3：AI 技术方案覆盖度 | 对比最终实现，模块级比对 | **85%** |
| 节4：AI 代码采纳率 | git diff 逐类统计，人工修改比例 | **70%** |
| 节5：测试报告摘要 | 用例数/通过率/覆盖率/补测轮次 | **87% 行覆盖率** |
| 节6：知识库命中追踪 | PRD/技术方案/测试三阶段命中路径 | — |

---

## 其他归档产出

| 产出 | 说明 |
|---|---|
| 知识库更新 | app-knowledge-base 增量更新 |
| OpenSpec 归档 | `/opsx:archive` 将接口变更记录归档（如有 OpenSpec 变更） |
| 归档 git commit | 带标记的归档提交，记录代码快照 hash |

---

## 代码采纳率说明

`AI 代码采纳率 = AI 生成代码中最终保留的行数 / AI 生成代码总行数`

本案例各类采纳率差异原因：

| 类 | 采纳率 | 主要人工修改原因 |
|---|---|---|
| SignSubmitServiceImpl | 80% | MQ 补偿逻辑（CR 发现缺失，人工重写） |
| SignPhotoPresignServiceImpl | 85% | 有效期提取为配置项 |
| SignSubmitController | 45% | 参数校验注解（@Size 等）大量人工补充 |

> 采纳率偏低通常说明知识库中缺少对应场景的规范参考，归档后自动纳入知识库，下次需求可提升命中。
