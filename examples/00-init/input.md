# Stage 00-init — 输入示例

## 用户输入

```
/00-init
```

## 说明

无需额外参数，Agent 自动完成：
- 检测并安装依赖插件（ecc、rtk、gitnexus、autoresearch）
- 检测项目 Java 版本、Maven 配置、JUnit 版本
- 生成 `.mrd-to-code-config.json` 本地配置文件（不提交 git）
- 生成 `.gitnexus` 本地配置文件（不提交 git）
