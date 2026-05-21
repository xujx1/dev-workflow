# 技术方案：项目风格画像与业务扩展 profile

## 背景

当前 dev-workflow 代码生成和 Review 使用的是通用的技术栈规范（`.mrd-to-code-config.json`），缺少对"每个业务系统如何写代码"的系统化建模。导致：

1. 生成代码"技术上正确，但不像本项目"：命名、分层、日志、异常处理与项目惯例不符。
2. Review 缺少业务 checkpoints：数据一致性、资金链路、状态流转等高风险场景没有专项检查规则。
3. 每次 Review 发现"不像本项目"都要人工纠偏，反馈无法沉淀，下次依然犯同样问题。

本技术方案承接**问题 4（业务系统扩展性）**，把"扩展性"从技术栈级别延伸到业务规范和代码风格层面。

## 目标

1. 定义三类 profile 文件：`business-profile.md`、`style-profile.md`、`review-profile.md`，建立标准格式。
2. 知识库阶段（Stage 01）从现有代码中自动生成初版 `style-profile.md`。
3. 归档阶段（Stage 04）根据 Review 纠偏记录持续修正 profile。
4. 明确哪些 Agent（`java-impl`、`java-review`、`testcode-gen`）加载哪些 profile。

---

## 方案设计

### 三类 profile 文件

#### `business-profile.md`（合成示例）

描述业务系统核心特征，帮助 AI 在技术方案和代码实现中识别高风险场景。

```markdown
# Business Profile: 示例业务域

## 业务特性
- 强幂等要求：所有写操作必须支持幂等，以 bizId 或 orderNo 作为幂等键。
- 状态机敏感：状态的流转不可逆，必须校验前置状态合法性。
- 最终一致性：跨应用通过消息异步解耦，允许短暂不一致，但必须有补偿机制。

## 高风险链路
- 出库链路：影响库存和财务，任何改动必须触发 OpenSpec 和 GitNexus。
- 支付结算：不允许 mock，必须对接真实沙箱（integration test exception）。

## 权限边界
- 跨域读：禁止服务端直接查询其他域主库，只允许通过接口或事件消费。
- 禁止操作：禁止在 Service 层直接修改 Entity 状态，必须通过 Domain 层。
```

#### `style-profile.md`（合成示例）

描述代码风格和惯用写法，帮助 AI 生成"像本项目"的代码。

```markdown
# Style Profile: 示例业务域

## 分层习惯
- Controller：只做参数校验 + 调用 AppService，禁止业务逻辑。
- AppService：编排，不含领域逻辑，负责事务边界。
- DomainService：核心业务逻辑，允许调用 Repository。
- Repository：只做数据访问，禁止业务逻辑。

## 命名习惯
- Request/Response：XxxRequest / XxxResponse（不用 DTO 后缀）。
- 领域对象：XxxBO（Business Object），转换类用 XxxConverter。
- 不使用 MapStruct，统一用手写 Converter 保持可读性。

## 日志习惯
- 入口日志：所有 AppService 入口必须打 info 日志，包含 bizId / orderNo。
- 敏感字段：手机号、身份证号禁止打日志，用 `****` 脱敏替代。
- 异常日志：业务异常打 warn，系统异常打 error，必须含堆栈。

## 异常习惯
- 业务异常：抛 BizException，包含 errorCode（枚举）+ message。
- 参数校验：在 Controller 或 AppService 入口用 Preconditions 检查，异常类型 BizException。
- 外部依赖异常：捕获并转换为 SystemException，禁止裸抛第三方异常。

## 测试习惯
- 命名：`testXxx_whenYyy_thenZzz`，清晰描述场景和预期。
- 组织：given-when-then 三段式，不省略 given。
- Mock：只 mock 外部依赖（Repository、RPC、消息），不 mock 领域逻辑。

## 注释习惯
- 普通代码不写解释性注释。
- 状态机、资金、库存、数据一致性逻辑必须说明业务原因。
```

#### `review-profile.md`（合成示例）

描述 Review 专项检查点，帮助 `java-review` 识别业务高风险 pattern。

```markdown
# Review Profile: 示例业务域

## 必检 checkpoints

### 数据一致性
- [ ] 跨域写操作是否走消息 + 幂等消费，而非同步调用？
- [ ] 分布式事务场景是否有补偿 / 对账逻辑？

### 状态流转
- [ ] 状态变更前是否校验了前置状态？
- [ ] 状态变更是否通过 Domain 层，而非直接修改 Entity 字段？

### 幂等
- [ ] 所有写接口是否有幂等键（bizId / orderNo）？
- [ ] 重复消费是否返回成功而非抛异常？

### 资金链路
- [ ] 资金相关逻辑是否有专项注释说明业务原因？
- [ ] 是否有 integration test 覆盖，而非纯 mock？

### 日志
- [ ] 入口是否打了包含业务标识的 info 日志？
- [ ] 敏感字段是否脱敏？
```

### profile 文件路径约定

```
{project-root}/
├── .workflow/
│   └── profiles/
│       ├── business-profile.md    # 业务特性和高风险链路
│       ├── style-profile.md       # 代码风格和惯用写法
│       └── review-profile.md      # Review 专项检查点
```

### Agent 加载 profile 规则

| Agent | 加载的 profile |
| --- | --- |
| `java-impl`（代码实现） | `style-profile.md` + `business-profile.md` |
| `java-review`（代码 Review） | `review-profile.md` + `business-profile.md` |
| `testcode-gen`（测试代码生成） | `style-profile.md` 中测试习惯部分 |
| `02-tech-design`（技术方案） | `business-profile.md`（识别高风险场景） |

加载方式：各 Agent SKILL.md 在 Context 加载段显式声明。知识库阶段生成 profile 后，若文件不存在，输出 warn 提示人工维护。

### profile 生成与维护流程

```
Stage 01（知识库梳理）:
  - 从现有代码中抽样，生成 style-profile.md 初版
    覆盖维度：分层习惯、命名习惯、日志习惯、异常习惯、测试习惯
  - business-profile.md 人工填写，或从 CONTEXT.md 中提取高风险链路部分
  - review-profile.md 人工填写初版（业务系统 TL 确认）

Stage 04（归档）:
  - Review 中出现的纠偏记录（命名不符、日志缺失、异常未转换等）自动追加到 style-profile.md
  - review-profile.md 中漏检的 checkpoint 由人工补充
  - 定期精简（建议每季度一次），合并重复规则，控制 profile 长度
```

### profile 试点策略

第一阶段不全面铺开，建议：

1. 选 1~2 个业务系统试点。
2. 先只落地 `style-profile.md` 和 `review-profile.md`（`business-profile.md` 人工维护）。
3. 观察 3~5 个需求的代码实现和 Review 准确性，记录纠偏次数变化。
4. 验证通过后，统一 profile 格式，在其他业务系统复制。

### 上收机制

当业务系统沉淀的 profile 规则具有通用性（如幂等检查、入口日志规范），可按层级上收：

| 层级 | 适用范围 | 触发条件 |
| --- | --- | --- |
| 项目级 | 当前业务系统 | 初始沉淀 |
| workspace 级 | 同一项目集多个应用 | 多应用共享且稳定 |
| org 级 | 整个组织 | 跨项目集普遍适用 |
| Harness 核心 | 所有用户 | 确认跨业务线通用后才进入 |

---

## 文件变更清单

| 文件 | 变更说明 |
| --- | --- |
| `.workflow/profiles/business-profile.md` | 新增，业务特性和高风险链路 |
| `.workflow/profiles/style-profile.md` | 新增，由知识库阶段自动生成初版 |
| `.workflow/profiles/review-profile.md` | 新增，Review 专项检查点 |
| `skills/mrd-to-code-v2/01-knowledge-base/SKILL.md` | 新增 style-profile 生成逻辑 |
| `skills/mrd-to-code-v2/04-archive/SKILL.md` | 新增 style-profile 归档修正逻辑 |
| 各 Agent SKILL.md（java-impl / java-review / testcode-gen） | 新增 profile 加载声明 |

---

## 验收标准

1. 知识库阶段（Stage 01）成功生成 `style-profile.md` 初版，覆盖分层、命名、日志、异常、测试五个维度。
2. `java-review` 加载 `review-profile.md` 后，输出包含业务专项 checkpoints（幂等、状态流转、资金链路）。
3. 归档阶段将 Review 纠偏记录追加到 `style-profile.md`，3 个需求后可观察到 profile 内容增长。
4. 试点业务系统代码实现中"不像本项目"的纠偏次数在 3~5 个需求内有明显下降趋势。

---

## 风险与注意事项

1. **profile 内容质量**：自动生成的 `style-profile.md` 可能不准确，需人工 review 初版后再使用，避免 AI 学到错误的风格。
2. **profile 膨胀**：随着归档持续修正，profile 可能膨胀导致上下文过长。建议每季度 review 精简，合并重复规则。
3. **business-profile 人工成本**：高风险链路和权限边界只能人工维护，不建议全自动生成。第一阶段由业务系统 TL 填写。
4. **profile 版本管理**：profile 文件应纳入 git 版本管理，确保修改可追溯。
