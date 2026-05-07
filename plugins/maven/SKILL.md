---
name: maven-plugin
version: v1.1.0
description: Maven 环境与覆盖率插件。统一解析项目/IDEA/用户级 Maven 命令、settings.xml、本地仓库、JDK 健康状态，并提供统一 JaCoCo 增量覆盖率入口。
type: plugin
trigger: global-maven
---

# Maven 环境与覆盖率插件

## 目标

解决以下常见问题：

- 不同开发者机器上的 `settings.xml`、本地仓库路径不同
- IDEA 项目级 Maven 配置与 shell 环境不一致
- `JAVA_HOME` 损坏时，Agent 误判 Maven/JDK 不可用
- 覆盖率脚本仍写死 `~/.m2/repository`
- 增量覆盖率脚本散落在 Agent 目录，不利于插件化复用

---

## 固定资源

- 解析器：`plugins/maven/maven_config_resolver.py`
- 覆盖率入口：`plugins/maven/jacoco_incremental_coverage.sh`

---

## 解析规则

### Maven 命令优先级

1. `./mvnw`
2. 项目 `.idea/workspace.xml` 中的 `mavenHome`
3. IDEA 全局 Maven 偏好
4. 系统 `mvn`
5. IDEA Bundled Maven

### `settings.xml` / 本地仓库优先级

1. 项目 `.mvn/maven.config`
2. 项目 `.idea/workspace.xml`
3. IDEA 全局 Maven 偏好
4. 用户级 `settings.xml`
5. 默认 `~/.m2`

### JDK 规则

- 优先使用项目在 IDEA 中绑定的 JDK
- 仅当 `bin/java` 可执行且 `java -version` 成功时，才视为健康 JDK
- 禁止把无效 `JAVA_HOME` 或 macOS `/usr/bin/java` stub 误判为可用 JDK

---

## 适用场景

- `testcode-gen-agent` 环境探测
- `tdd-test-runner-agent` 环境探测
- JaCoCo 增量覆盖率统一入口与 Maven 本地仓库定位
- 任何需要读取项目真实 Maven 配置的插件或 Agent
