# project-init 配置文件输出结构

`project-init` 写入 `.mrd-to-code-config.json` 的字段：

> **核心参数硬约束**：`openspec` 的 4 个字段和 `test_runtime.mode` 必须完整写入，遗漏即判定失败。

```json
{
  "env": {
    "repo_path": "/path/to/your-app",
    "java": {
      "detected": true,
      "version": "1.8.0_482",
      "vendor": "Amazon.com Inc.",
      "runtime": "/path/to/jre"
    },
    "maven": {
      "detected": true,
      "version": "3.9.12",
      "home": "/path/to/maven"
    },
    "env_confirmed": true,
    "detected_at": "2026-05-06T15:30:00Z"
  },
  "test_runtime": {
    "mode": "mock-first",
    "frameworks": ["junit", "spring-boot-starter-test", "mockito"],
    "test_dirs": [
      "module-a/src/test",
      "module-b/src/test"
    ]
  },
  "openspec": {
    "enabled": true,
    "threshold_person_days": 5,
    "generate_stage": "before_code_gen",
    "archive_in_stage4": true
  }
}
```

## 字段来源说明

| 段 | 字段 | 写入者 | 说明 |
|----|------|--------|------|
| `env` | `repo_path` | **project-init（新增）** | 业务工程根目录绝对路径，供 plugin-init 定位 OpenSpec/GitNexus/Beads 执行位置 |
| `env` | 其余 | project-init | Java/Maven/项目结构 |
| `test_runtime` | `mode` | **project-init（硬约束）** | 默认 `"mock-first"`，不可遗漏 |
| `test_runtime` | 其余 | project-init | jacoco/maven_test/test_classes 等 |
| `openspec` | `enabled`, `threshold_person_days`, `generate_stage`, `archive_in_stage4` | **project-init（硬约束）** | 4 字段必须完整写入 |
| `openspec` | `available`, `version` | plugin-init | OpenSpec 安装检测，project-init 不写入 |
| `plugin_availability` | 全部 | plugin-init | 插件安装状态 |

# 输出汇总

```
## project-init 完成

| 检查项            | 结果                    | 状态 |
|-------------------|-------------------------|------|
| Java 版本         | {java_version}          | ✅   |
| Java Vendor       | {java_vendor}           | ✅   |
| Maven 版本        | {maven_version}         | ✅   |
| 项目 GroupId      | {project_groupId}       | ✅   |
| 项目 ArtifactId   | {project_artifactId}    | ✅   |
| 多模块            | {project_modules}       | ✅/- |
| Beads 任务追踪    | {beads_status}          | ✅/⚠️ |

下一步：
- 安装插件 → /dev-workflow:00-init（plugin-init 模式）
- 插件已就绪 → /dev-workflow:01-knowledge-base
```
