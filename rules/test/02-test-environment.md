# 测试环境策略（Test Environment Strategy）

> 仓库级测试规约分片。用于约束测试环境策略与测试依赖配置。

---

## 核心约定

测试环境统一使用 **mock-first** 模式。

- 不启动本地服务或容器
- 数据库、Redis、RPC、MQ、HTTP 均使用 Mock / Stub
- 测试框架统一使用 JUnit4 + Mockito
- HTTP 场景优先 standalone `MockMvc`（`MockMvcBuilders.standaloneSetup(...)`）
- 非 HTTP 场景使用纯 Mockito / unit tests
- 不依赖 Spring 容器，不继承任何 Spring 测试基类

---

## 标准测试依赖（JUnit4 + Mockito）

> 此节为 **Phase 0 依赖扫描** 和 **testcode-gen-agent step1-precheck** 的唯一权威来源。

### 快速检测命令

```bash
# 检测目标模块 pom.xml 是否已声明 JUnit4 和 Mockito（在模块目录下执行）
grep -r "junit\|mockito-core" pom.xml 2>/dev/null \
  | grep -v "<!--" | head -20
```

### 缺失时的补全方式

**优先查找本地 ~/.m2 已缓存版本（避免网络下载）：**

```bash
# 查找本地已有的 JUnit4 版本
find ~/.m2/repository/junit/junit -name "*.jar" 2>/dev/null \
  | grep -v sources | sort | tail -3

# 查找本地已有的 Mockito 版本
find ~/.m2/repository/org/mockito/mockito-core -name "*.jar" 2>/dev/null \
  | grep -v sources | sort | tail -3
```

**标准 pom.xml 依赖片段（补入 `<dependencies>` 中）：**

```xml
<!-- JUnit4 -->
<dependency>
    <groupId>junit</groupId>
    <artifactId>junit</artifactId>
    <version>4.13.2</version>  <!-- 优先继承父 pom 版本 -->
    <scope>test</scope>
</dependency>

<!-- Mockito -->
<dependency>
    <groupId>org.mockito</groupId>
    <artifactId>mockito-core</artifactId>
    <version>4.11.0</version>  <!-- 优先继承父 pom 版本 -->
    <scope>test</scope>
</dependency>
```

### execution-state.md 缓存字段约定

| 字段 | 值 | 写入时机 |
|---|---|---|
| `env_confirmed` | `true` | Phase 0 确认 Maven/JDK 可用后 |
| `maven_cmd` | 实际 mvn 可执行路径 | Phase 0 探测后 |
| `maven_settings` | settings.xml 实际绝对路径 | Phase 0 find 到后 |
| `test_deps_confirmed` | `true` | Phase 0 确认/补全 JUnit4+Mockito 后 |

> 后续所有 agent（testcode-gen step1、tdd-test-runner 等）读到以上字段后，**禁止**重复执行对应探测命令。
