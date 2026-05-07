# Stage 03-code-gen-tdd — 产出说明

## 产出文件一览

| 文件 | 生成时机 | 说明 |
|---|---|---|
| [test_spec.md](./test_spec.md) | 代码生成前 | 测试规格文档，定义所有测试类和测试用例 |
| [code-review.md](./code-review.md) | 代码生成后 | java-review-agent 输出的代码审查报告 |
| [unit_test_report.md](./unit_test_report.md) | 单测执行后 | JaCoCo 增量覆盖率报告 + 自动纠错记录 |

---

## test_spec.md — 测试规格文档

> 示例见：[test_spec.md](./test_spec.md)

generate-tdd-test-spec agent 在代码生成前，基于技术方案和测试知识库生成测试规格。

本案例规格概览：

| 测试类 | 测试数 | 覆盖目标 |
|---|---|---|
| SignSubmitServiceImplTest | 6 | 签收提交主流程 + 幂等 |
| SignPhotoPresignServiceImplTest | 3 | OSS 预签名 URL 生成 |
| SignQueryServiceImplTest | 4 | 签收记录查询 |

飞书原文：https://your-domain.feishu.cn/wiki/SNEgwMblLiFx7Skmv16cJVjcnYk

---

## code-review.md — 代码审查报告

> 示例见：[code-review.md](./code-review.md)

java-review-agent 基于 `rules/java/standards/` 规范体系，对生成代码进行静态审查。

本案例结论：

| 级别 | 数量 |
|---|---|
| 高优先级（必须修复） | 0 |
| 中优先级（建议修复） | 3 |
| 低优先级/建议 | 2 |
| **整体评级** | **通过** |

飞书原文：https://your-domain.feishu.cn/wiki/BiT5w5jJsil91ekSkI8cq7JfnHg

---

## unit_test_report.md — 单元测试覆盖率报告

> 示例见：[unit_test_report.md](./unit_test_report.md)

tdd-test-runner-agent 执行 Maven 测试，采集 JaCoCo 增量覆盖率，准出线为行覆盖率 ≥ 80%。

本案例执行过程：

```
第一次执行：行覆盖率 72% → 不达标 → 自动触发补测
补充 TC-13、TC-14 后重新生成测试代码
第二次执行：行覆盖率 87% → 达标 ✅
```

最终覆盖率：

| 类 | 行覆盖率 | 分支覆盖率 |
|---|---|---|
| SignSubmitServiceImpl | 91% | 85% |
| SignPhotoPresignServiceImpl | 88% | 83% |
| SignQueryServiceImpl | 82% | 80% |
| **增量整体** | **87%** | **83%** |

飞书原文：https://your-domain.feishu.cn/wiki/IxpGwl9RHi5oBZkiGYjc9jiPnUh

---

## req/ 目录产出文件

```
req/当面开箱拍照签收/
├── execution-state.md     ← 阶段状态持久化（Agent 自动维护）
├── test_spec.md           ← 测试规格文档
├── test_file_list.md      ← 生成的测试文件清单
└── apps.json              ← 跨域场景下的应用路由结果
```
