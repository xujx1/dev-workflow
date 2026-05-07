# Step 2 入口定位（P0）

## 目标

基于 `test_spec` 找到真实测试入口，禁止从内部实现层直接开测。

## 入口硬规则

- 必须是最外层入口：
  - HTTP Controller
  - Dubbo Facade
  - MQ Listener / Consumer
- 禁止停在 Service、Handler、Adapter、Flow 等中间层
- 找不到入口时立即中断，不得继续生成

## 定位步骤

1. 从 `test_spec` 提取被测入口或被测类
2. 向上搜索调用链
3. 确认入口类型
4. 给出测试类命名与测试方式

## 入口到测试方式映射

| 入口类型 | 测试类命名 | 测试方式 |
|----------|------------|----------|
| HTTP Controller | `{ControllerName}Test` | `MockMvc` |
| Dubbo Facade | `{FacadeName}Test` | 直接调用 Facade |
| MQ Listener | `{ListenerName}Test` | 直接调用消费方法 |

## 输出

- 入口类全名
- 入口类型
- 测试类命名
- 对应模块
