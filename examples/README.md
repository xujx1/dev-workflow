# examples — 各阶段输入与产出示例

本目录展示 dev-workflow 全流程各阶段的典型输入与产出，以「当面开箱拍照签收」需求为示例案例。

## 目录结构

```
examples/
├── 00-init/                     # Stage 0：初始化
│   ├── input.md                 # 用户输入示例（/00-init）
│   ├── output.md                # 产出说明索引
│   └── mrd-to-code-config.json  # 产出：项目配置文件
│
├── 01-knowledge-base/           # Stage 1：知识库梳理
│   ├── input.md                 # 用户输入示例（/01-knowledge-base）
│   ├── output.md                # 产出说明索引
│   └── KB_FRESHNESS.md          # 产出：知识库保鲜标记
│
├── 02-implementation-plan/      # Stage 2：PRD + 技术方案
│   ├── input.md                 # 用户输入示例（/02-implementation-plan + MRD + 项目路径）
│   ├── output.md                # 产出说明索引
│   ├── mrd-clarified.md         # 产出：MRD 澄清版
│   ├── prd.md                   # 产出：PRD（运配域）
│   └── tech-design.md           # 产出：技术方案（carrier 应用）
│
├── 03-code-gen-tdd/             # Stage 3：代码生成 + TDD
│   ├── input.md                 # 用户输入示例（/03-code-gen-tdd + 需求空间）
│   ├── output.md                # 产出说明索引
│   ├── test_spec.md             # 产出：测试规格文档
│   ├── code-review.md           # 产出：代码审查报告
│   └── unit_test_report.md      # 产出：单元测试覆盖率报告
│
└── 04-archive/                  # Stage 4：归档
    ├── input.md                 # 用户输入示例（/04-archive + 需求空间）
    ├── output.md                # 产出说明索引
    └── archive-report.md        # 产出：需求归档报告
```

## 对应真实案例链接

| 阶段 | 飞书文档 |
|---|---|
| 履约域 PRD | https://your-domain.feishu.cn/wiki/Tp61wB8uTiIstokfhgAcZvZ6nig |
| 运配域 PRD | https://your-domain.feishu.cn/wiki/CbJBw6erBihT3ekE2koc3WLKnXe |
| carrier 技术方案 | https://your-domain.feishu.cn/wiki/GzDQwjJ7RinnqUkiMNGc6i6qnpg |
| carrier 测试用例 | https://your-domain.feishu.cn/wiki/SNEgwMblLiFx7Skmv16cJVjcnYk |
| carrier 代码审查报告 | https://your-domain.feishu.cn/wiki/BiT5w5jJsil91ekSkI8cq7JfnHg |
| carrier 单测报告 | https://your-domain.feishu.cn/wiki/IxpGwl9RHi5oBZkiGYjc9jiPnUh |
| 需求归档报告 | https://your-domain.feishu.cn/wiki/BcIawkm3OikY8Xkg8IQcL1mdnWd |
