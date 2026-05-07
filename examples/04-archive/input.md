# Stage 04-archive — 输入示例

## 用户输入

```
/04-archive
需求空间：@req/当面开箱拍照签收
```

## 参数说明

| 参数 | 是否必填 | 说明 |
|---|---|---|
| `需求空间：@req/<需求名>` | 必填 | 指向本次需求的产出目录 |

## 说明

建议在**合并 release 分支之前**执行。Agent 自动完成：

1. **锁定代码版本**：记录当前 git 快照 commit hash
2. **归档 OpenSpec**：`/opsx:archive` 将本次接口变更归档到 OpenSpec
3. **更新知识库**：kb-update-agent 并行更新应用知识库、业务知识库、测试知识库
4. **生成归档报告**：archive-report-agent 生成含 6 节的需求跟踪报告（见 archive-report.md 示例）
5. **上传飞书**：归档报告自动上传至飞书
6. **归档 commit**：生成带标记的 git commit

## 产出文件

```
req/当面开箱拍照签收/
└── archive-report.md     ← 需求归档报告（见 archive-report.md 示例）
```

## 归档报告核心指标（本案例数值）

| 指标 | 数值 |
|---|---|
| MRD 标准度 | 78 / 100 |
| AI PRD 功能覆盖度 | 91% |
| AI 技术方案覆盖度 | 85% |
| AI 代码采纳率 | 70% |
| 单测行覆盖率 | 87% ✅ |
