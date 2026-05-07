# Stage 02-implementation-plan — 产出说明

## 产出文件一览

| 文件 | 生成时机 | 说明 |
|---|---|---|
| [mrd-clarified.md](./mrd-clarified.md) | 需求澄清后 | MRD 确认版，含澄清问答和应用确认表 |
| [prd.md](./prd.md) | PRD 生成后 | 按领域拆分的 PRD（本例为运配域） |
| [tech-design.md](./tech-design.md) | 技术方案生成后 | 按应用拆分的技术方案（本例为 carrier 应用） |

---

## mrd-clarified.md — MRD 澄清版

> 示例见：[mrd-clarified.md](./mrd-clarified.md)

mrd-clarify-agent 对原始 MRD 进行分析，识别模糊项并向用户提问，确认后生成澄清版。

本案例澄清了 4 个关键问题：
- 签收照片存储方案（OSS 直传 + 路径规范）
- 跨域同步方式（RPC / MQ / 轮询分别对应不同下游）
- 签收失败处理（逆向申诉不在本期范围）
- 幂等性要求（orderId + signTime 作为幂等键）

---

## prd.md — 领域 PRD

> 示例见：[prd.md](./prd.md)（运配域）

本案例为**跨域需求**，app-router-agent 将需求路由后拆分为两个领域 PRD：

| 领域 | 飞书文档 |
|---|---|
| 履约域 PRD | https://your-domain.feishu.cn/wiki/Tp61wB8uTiIstokfhgAcZvZ6nig |
| 运配域 PRD | https://your-domain.feishu.cn/wiki/CbJBw6erBihT3ekE2koc3WLKnXe |

PRD 结构：背景与目标 → 用户角色 → 功能变更 → 验收标准 → 业务边界

---

## tech-design.md — 技术方案

> 示例见：[tech-design.md](./tech-design.md)（carrier 应用）

本案例涉及 5 个应用，每个应用单独生成技术方案：

| 应用 | 飞书文档 |
|---|---|
| your-app-name | https://your-domain.feishu.cn/wiki/Wj5EwYgXViJe2rkfnl1cuGyHnpe |
| your-app-name-2 | https://your-domain.feishu.cn/wiki/NeZHw6k7Ji1yDEk8qurcXnkenxe |
| your-app-name | https://your-domain.feishu.cn/wiki/GzDQwjJ7RinnqUkiMNGc6i6qnpg |
| your-app-name-4 | https://your-domain.feishu.cn/wiki/Cn0Zw7p1ii0FTrkrJbOc9OKtnad |
| your-app-name-5 | https://your-domain.feishu.cn/wiki/Yg2Aw9J2di78NxkyRL7ck8JenXb |

技术方案结构：接口变更清单 → DB Schema → 核心逻辑设计 → 时序图 → 工时预估

**OpenSpec 触发规则**：工时预估 ≥ 5 人日时，自动触发 OpenSpec 规格生成。本案例 carrier 应用工时 3.0 人日，未触发。
