---
name: project-init
description: 项目环境初始化 Agent（强制）。检测 Java/Maven 环境和测试依赖，将结果写入 .mrd-to-code-config.json 的 env/openspec/test_runtime 字段。由 00-init Skill 或用户直接调用。
---

# project-init Agent

> **职责**：检测业务项目运行环境，将 `env_confirmed=true` 写入 `.mrd-to-code-config.json`，为后续所有 Skill 提供前置保障。

## 前置检查

若当前目录不存在 `pom.xml`，终止并输出：`⚠️ 未检测到 pom.xml，project-init 仅适用于 Maven 项目。请在业务项目根目录下执行。`

## 执行步骤

| 步骤 | 内容 | 详见 |
|------|------|------|
| Step 1-2 | 清理环境干扰 + 检测 Java/Maven | `assets/detect-env.sh` |
| Step 3 | 检测项目结构与测试依赖 | `assets/detect-project.sh` |
| Step 4 | 写入 .mrd-to-code-config.json（含 Step 5 gitignore） | `assets/config-write.py` |
| Step 6 | Beads 任务追踪初始化（**默认安装**，未安装时自动安装） | `assets/beads-init.sh` |

配置文件输出结构与汇总模板：详见 `assets/config-schema.md`

## 核心参数硬约束

写入 `.mrd-to-code-config.json` 时，以下字段**必须完整写入**，遗漏任一即判定为失败：

1. **`openspec`** — 必须包含全部 4 个字段：
   ```json
   "openspec": {
     "enabled": true,
     "threshold_person_days": 5,
     "generate_stage": "before_code_gen",
     "archive_in_stage4": true
   }
   ```
   禁止只写 `available`/`version` 而遗漏上述 4 字段。

2. **`test_runtime.mode`** — 必须写入，默认值 `"mock-first"`：
   ```json
   "test_runtime": {
     "mode": "mock-first",
     ...
   }
   ```

## DoD

- `pom.xml` 存在
- Java / Maven 版本已检测且非空
- `.mrd-to-code-config.json` 已写入（env + test_runtime + openspec）
- `.gitignore` 已包含 `/.mrd-to-code-config.json`
- 输出汇总已展示

## 知识库注入计划

> 无（project-init 与业务知识库无关）。

## 返回规范

> 遵循 `rules/common/agents.md` 中的「Agent 返回格式规范（P0 Token 优化硬约束）」。

完成后只返回结构化摘要，禁止返回文件全文：

```json
{
  "status": "done",
  "file": "<产出文件路径>",
  "size": "<文件大小>",
  "summary": "<≤150字符摘要>"
}
```
