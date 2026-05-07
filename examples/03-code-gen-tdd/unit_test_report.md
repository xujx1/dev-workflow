# 单元测试覆盖率报告 — 当面开箱拍照签收（carrier）

> 执行时间：2026-04-10
> 飞书原文：https://your-domain.feishu.cn/wiki/IxpGwl9RHi5oBZkiGYjc9jiPnUh
> 执行 Agent：tdd-test-runner-agent
> Maven 命令：`mvn test -pl . -Dtest=SignSubmitServiceImplTest,SignPhotoPresignServiceImplTest,SignQueryServiceImplTest`

---

## 执行结论

**状态：✅ PASS（覆盖率达标）**

> 第一次执行覆盖率 72%（未达标），自动触发补测，第二次执行覆盖率 87%，达标。

---

## 测试执行摘要

| 测试类 | 总用例 | 通过 | 失败 | 跳过 |
|---|---|---|---|---|
| SignSubmitServiceImplTest | 6 | 6 | 0 | 0 |
| SignPhotoPresignServiceImplTest | 3 | 3 | 0 | 0 |
| SignQueryServiceImplTest | 4 | 4 | 0 | 0 |
| **合计** | **13** | **13** | **0** | **0** |

---

## JaCoCo 增量覆盖率（最终版）

> 基准：master 分支；增量：本次 feature 分支变更类

| 类 | 行覆盖率 | 分支覆盖率 | 方法覆盖率 |
|---|---|---|---|
| `SignSubmitServiceImpl` | 91% | 85% | 100% |
| `SignPhotoPresignServiceImpl` | 88% | 83% | 100% |
| `SignQueryServiceImpl` | 82% | 80% | 100% |
| **增量整体** | **87%** | **83%** | **100%** |

**准出线：行覆盖率 ≥ 80% ✅**

---

## 自动纠错记录

### 第一次执行（覆盖率不达标）

```
执行时间：2026-04-10 14:20
整体行覆盖率：72%
未覆盖方法：SignQueryServiceImpl.buildSignedUrl (L145-L162)
判断：覆盖率不足 → 触发自动补测
```

### 自动补充的测试用例

- TC-13（新增）：photoUrl 签名过期转换
- TC-14（新增）：buildSignedUrl 边界场景（photoKey 为空）

### 第二次执行（覆盖率达标）

```
执行时间：2026-04-10 14:35
整体行覆盖率：87%
状态：PASS，达标
```

---

## 测试代码清单

飞书：https://your-domain.feishu.cn/wiki/Qcs6wO2VIi2woDklzNMcBBDPnMf

| 测试文件 | 路径 |
|---|---|
| `SignSubmitServiceImplTest.java` | `src/test/java/com//carrier/service/impl/` |
| `SignPhotoPresignServiceImplTest.java` | `src/test/java/com//carrier/service/impl/` |
| `SignQueryServiceImplTest.java` | `src/test/java/com//carrier/service/impl/` |

---

## 执行环境

```
Java:  1.8.0_482
Maven: 3.9.12
JUnit: 4.13.2
Mockito: 4.11.0
JaCoCo: 0.8.8
```
