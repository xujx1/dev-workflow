# Stage 00-init — 产出说明

## 产出文件

### `.mrd-to-code-config.json` — 项目本地配置

> 示例见：[mrd-to-code-config.json](./mrd-to-code-config.json)

Agent 完成环境探测和插件安装后，在项目根目录生成本文件。记录四大板块：

| 字段块 | 说明 |
|---|---|
| `env` | Java/Maven 版本、测试框架探测结果（JUnit4/5、Mockito） |
| `openspec` | OpenSpec 开关及工时阈值（默认 5 人日触发） |
| `test_runtime` | 测试运行模式（固定 `mock-first`） |
| `plugin_availability` | 各层插件可用状态（ecc / rtk / gitnexus / autoresearch / pua） |

**注意：此文件为本地配置，不需要提交到 git。**

### `.gitnexus` — GitNexus 本地索引

本地 git 仓库索引文件，同样不需要提交。

## 关键字段示例

```json
{
  "env": {
    "java_version": "1.8.0_482",
    "test_deps_junit_version": 4,
    "test_deps_mockito": true,
    "env_confirmed": true
  },
  "test_runtime": {
    "enabled": true,
    "mode": "mock-first"
  },
  "plugin_availability": {
    "l0_ecc": "available",
    "l1_rtk": "available",
    "l2_gitnexus": "not_indexed",
    "l3_autoresearch": "available"
  }
}
```

详细字段说明见 [mrd-to-code-config.json](./mrd-to-code-config.json)。
