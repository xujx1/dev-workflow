# 技术方案：Harness 安装层级设计

## 背景

当前 dev-workflow Harness 的安装和配置是扁平的：所有配置放在项目根目录的 `.mrd-to-code-config.json` 和 `skills/` 目录下，没有区分"组织级共享"、"项目集共享"和"单项目专属"三个层级。

导致的问题：
1. 多个项目想共享同一套组织规范（如代码风格、命名约定、安全检查规则），但每个项目都需要各自维护，同步困难。
2. 某个项目的特殊配置无意中影响了同 monorepo 中的其他项目。
3. Harness 升级时，无法区分"需要统一升级"和"项目自定义保留"的部分。

## 目标

1. 设计三层安装层级：组织级（org）、项目集级（workspace）、项目级（project）。
2. 低层级配置可覆盖高层级配置的特定字段，继承未覆盖字段。
3. 明确每层的文件路径约定和职责边界。
4. 支持"仅更新组织级"的升级路径，不影响项目级自定义。

---

## 方案设计

### 三层层级定义

```
Layer 1: 组织级（org）
  路径: ~/.config/mrd-to-code/org-config.json  或  {org-repo}/.mrd-to-code-org.json
  职责: 全组织共享的规范（代码风格、安全检查规则、禁用的 LLM 模型）
  维护方: 基础设施团队 / 架构师

Layer 2: 项目集级（workspace）
  路径: {monorepo-root}/.mrd-to-code-workspace.json
  职责: 同一 monorepo 内共享的配置（公共依赖版本、共享知识库路径）
  维护方: 技术负责人

Layer 3: 项目级（project）
  路径: {project-dir}/.mrd-to-code-config.json
  职责: 单项目专属配置（tech_stack、test_framework、openspec 阈值）
  维护方: 各项目开发者
```

### 配置继承规则

```
合并优先级: project > workspace > org

规则:
1. project 中未声明的字段，从 workspace 继承。
2. workspace 中未声明的字段，从 org 继承。
3. project 可通过 "override": true 显式声明覆盖，提高可读性。
4. 不允许 project 覆盖 org 中标记为 "locked": true 的字段。
```

### 配置文件结构示例

#### org-config.json（组织级）

```json
{
  "version": "1.0",
  "layer": "org",
  "code_style": {
    "max_line_length": 120,
    "indent": "4-spaces"
  },
  "security": {
    "forbidden_models": ["gpt-3.5-turbo"],
    "locked": true
  },
  "knowledge_base": {
    "default_freshness_threshold": 5
  }
}
```

#### .mrd-to-code-workspace.json（项目集级）

```json
{
  "version": "1.0",
  "layer": "workspace",
  "shared_knowledge_base": "shared-knowledge-base/",
  "common_dependencies": {
    "spring_boot_version": "3.2.0"
  }
}
```

#### .mrd-to-code-config.json（项目级）

```json
{
  "version": "1.0",
  "layer": "project",
  "project": {
    "name": "order-service",
    "tech_stack": "java-spring-boot"
  },
  "openspec": {
    "override": true,
    "default_threshold_days": 3
  }
}
```

### 配置加载顺序

```
Step 1: 加载 org 配置（从 ~/.config 或组织共享仓库）
Step 2: 加载 workspace 配置（从 monorepo 根目录，若存在）
Step 3: 加载 project 配置（从项目目录）
Step 4: 三层合并，project 优先，locked 字段不可被低层覆盖
Step 5: 合并结果写入运行时配置缓存（.workflow/resolved-config.json）
```

### Harness 升级路径

升级时按层级分别处理：

```bash
# 只升级组织级配置（统一推送）
mrd-upgrade --layer org --version 2.0

# 升级项目集级配置
mrd-upgrade --layer workspace

# 升级项目级（需人工确认，避免覆盖自定义）
mrd-upgrade --layer project --interactive
```

### 运行时配置缓存

合并后的配置写入 `.workflow/resolved-config.json`，供各 Agent 读取（只读，不直接编辑）。

---

## 文件变更清单

| 文件 | 变更说明 |
| --- | --- |
| `~/.config/mrd-to-code/org-config.json` | 新增，组织级配置（可选，不存在则跳过） |
| `{monorepo-root}/.mrd-to-code-workspace.json` | 新增，项目集级配置（可选，不存在则跳过） |
| `.mrd-to-code-config.json` | 新增 `layer: "project"` 字段声明 |
| `.workflow/resolved-config.json` | 运行时生成，三层合并后的配置 |
| `.workflow/scripts/config-resolver.js` | 新增，配置合并逻辑 |
| `skills/mrd-to-code-v2/SKILL.md` | 新增三层配置加载说明 |

---

## 验收标准

1. project 中未声明的字段，能从 workspace / org 正确继承。
2. org 中标记 `"locked": true` 的字段，project 配置无法覆盖。
3. `.workflow/resolved-config.json` 在每次运行前自动更新，反映最终合并配置。
4. `mrd-upgrade --layer org` 只更新 org 配置，不影响 project 自定义配置。

---

## 风险与注意事项

1. **org 配置来源**：组织级配置需要有明确的来源（本地文件 vs 远程仓库），建议初期用本地文件，后续可扩展为从 git 拉取。
2. **合并冲突可读性**：三层合并后，开发者可能难以判断某个配置值来自哪一层，`resolved-config.json` 需增加来源注释。
3. **向后兼容**：已有项目只有 project 级配置，upgrade 时需能无缝识别，不强制要求 org 和 workspace 层存在。
