# PRD 生成详细执行规则

> 本文件由 `prd-generator-agent.md` 骨架按需 Read。


## Step 1：并行读取知识库（必须执行）

同时执行（不得串行）：

**A. 需求源**：`Read {mrd_local_path}`

**B. 应用知识库（事实基准）**：
- `Read {kb_local_path}/CONTEXT.md`
- `Read {kb_local_path}/02_架构与设计层.md`
- `Read {kb_local_path}/03_核心流程与逻辑层.md`
- `Read {kb_local_path}/db-schema.md`（若存在）

**C. 模板**：`Read agents/prd-generator/assets/prd-template.md`

⚠️ 所有 Read 操作全部返回后，才能进入 Step 2。

## Step 2：确认输入为澄清版 MRD

- `mrd_local_path` 必须指向 `mrd-clarified.md`
- 若传入原始 MRD 路径，停止执行
- 直接基于 `mrd-clarified.md` 生成 PRD，残余歧义记录到 PRD 七章

## Step 3：生成 PRD 草稿

**文档结构**（只含七章正文，无任何附录）：
```
# {需求名称} — 产品需求文档
## 一、背景
## 二、目标
## 三、角色 / 场景
## 四、功能变更
## 五、业务规则
## 六、验收标准（AC）
## 七、边界 / 待确认
```

**内容约束**：
- 产品正文使用业务语言，不出现接口签名、SQL、代码块、字段枚举值
- 流程图使用 Mermaid（`flowchart TD`/`sequenceDiagram`/`stateDiagram-v2`）
- 禁止 ASCII art，禁止 PlantUML
- **硬约束：禁止生成任何附录**
- **硬约束：禁止生成技术内容**（接口路径、DB Schema、枚举代码）
- **禁止生成需求拆解**（Story + 开发任务由技术方案附录I承载）
- 禁止在 prd.md 中留存任何 `❓ [需确认]` 标注

**PRD 禁止包含的技术细节**：

| 禁止类型 | 应替换为 |
|---------|---------|
| HTTP 接口路径 `/electronicSheet/query` | 功能模块名，如"仓发面单查询" |
| RPC/Dubbo 签名 | "品牌直发面单服务" |
| 代码字段名 `qrCode` | "二维码" |
| 配置 Key `des.sf.qrcode.xxx` | "灰度开关（默认关闭）" |
| 类名/方法名 `ElectronicSheetService` | 删除，技术细节留给技术方案 |
| DB 表名/列名 | 删除，技术细节留给技术方案 |

**写入方式**：
- 优先：Write 工具分章节写入（先写标题骨架，再逐章节 Edit 填充）
- 备选（Write 被 Hook 阻止时）：Bash heredoc 写入

## Step 4：自检

- 所有章节（一~七）已填充（无空章节）
- 无 ASCII 图表
- **不存在任何附录章节**（违反则删除后重新自检）
- `prd.md` 中不含任何 `❓ [需确认]` 标注
- **无任何代码块**（无 ` ``` ` 标记；违反则将代码块替换为产品语言描述后重新自检）
- **无技术章节**（文档章节只允许「一、背景」「二、目标」「三、角色/场景」「四、功能变更」「五、业务规则」「六、验收标准」「七、边界/待确认」；如出现「接口设计」「业务逻辑」「非功能需求」等技术章节，删除后重新自检）
- **无技术符号**：不得出现类名（XxxServiceImpl）、包路径（com.xxx）、方法签名（xxx#yyy）、枚举值（XXX(15)）；违反则替换为业务语言后重新自检
