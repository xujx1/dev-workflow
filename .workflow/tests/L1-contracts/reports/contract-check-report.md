# L1 契约检查报告

生成时间: 2026-05-21T14:09:53.003Z
检查路径: /Users/admin/trae/dev-workflow/skills

## 汇总

| 指标 | 数值 |
|------|------|
| 总 Skills | 5 |
| 通过 | 5 |
| 失败 | 0 |
| 状态 | PASS |

## 详细结果

### ✅ 00-init

- 版本: v2.1.0
- 描述: dev-workflow 初始化 Skill。包含三个子流程：project-init（必做，项目环境初始化）、plugin-init（推荐，插件安装，默认含 ...


### ✅ 01-knowledge-base

- 版本: v4.0.0
- 描述: 梳理知识库（应用知识库 + biz prd-context）。并行调度子 Agent，全部完成后交叉验证一致性。当用户说"梳理知识库"、"生成知识库"、"一键知...


### ✅ 02-implementation-plan

- 版本: v1.1.0
- 描述: 生成实施方案（PRD + 技术方案）。支持多域模式：PRD 按领域聚合，技术方案按应用拆分，各应用保存所属域 PRD 副本。从 MRD 一次性产出 PRD + ...


### ✅ 03-code-gen-tdd

- 版本: v3.1.2
- 描述: 生成代码（含 TDD 验证循环）。统一主入口，支持两种输入模式——**full 模式**（需求空间：PRD + 技术方案，需先完成入口3）和 **tech-on...


### ✅ 04-archive

- 版本: v3.1.1
- 描述: 归档需求。顺序调度归档链路：有 OpenSpec 时先归档 OpenSpec；归档前先锁定当前分支最新代码快照作为事实基线；随后更新三类知识库（应用+业务+测试...


---

*本报告由 check-contracts.js 自动生成*
