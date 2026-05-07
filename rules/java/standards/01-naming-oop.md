# Java 规范 — 命名、常量与 OOP

> 来源：[飞书 Java 开发规范](https://your-domain.feishu.cn/wiki/CYKww0XMyiNqvUkumwoclvPtn3f)，第1-3章
> 索引：[../\_index.md](../_index.md)

---

## 一、命名规范

```
类名：UpperCamelCase，例外：DO / BO / DTO / VO / AO
方法名、变量名、参数名：lowerCamelCase
常量：UPPER_SNAKE_CASE，语义完整，不怕名字长
包名：全小写，单数形式
```

**强制**

- 禁止拼音与英文混用，禁止直接使用中文
- 禁止以下划线或美元符号开头/结尾
- 禁止随意缩写（`condi` `AbsClass` 等）
- POJO 类布尔字段不加 `is` 前缀（框架序列化会误解析）
- 抽象类以 `Abstract`/`Base` 开头；异常类以 `Exception` 结尾；测试类以 `Test` 结尾
- Service/DAO 实现类用 `Impl` 后缀区分接口

**领域模型命名**

- `xxxDO`：数据对象（对应数据库表）
- `xxxDTO`：数据传输对象
- `xxxVO`：展示对象
- 禁止命名成 `xxxPOJO`

---

## 二、常量定义

- 禁止魔法值直接出现在代码中，必须先定义常量
- `long`/`Long` 赋值必须用大写 `L`（避免与数字 `1` 混淆）
- 按功能归类常量，禁止用一个大而全的常量类维护所有常量
- 有限值域 + 延伸属性时使用枚举，枚举成员全大写加下划线

---

## 三、OOP 规约

**强制**

- 静态变量/方法通过类名访问，不通过实例访问
- 覆写方法必须加 `@Override`
- 包装类对象比较值必须用 `equals`，不用 `==`（Integer 仅 -128~127 可用 `==`）
- `equals` 调用方用常量或非空对象：`"constant".equals(variable)`
- POJO 类属性全部用包装数据类型；RPC 方法返回值和参数用包装类型
- POJO 类属性禁止设置默认值
- 构造方法禁止加业务逻辑，初始化逻辑放 `init()` 方法
- 过时接口必须加 `@Deprecated` 并说明替代方案，禁止调用过时方法
- 序列化类新增字段不修改 `serialVersionUID`；不兼容升级才修改

**推荐**

- 类成员访问控制从严：能 `private` 不 `protected`，能 `protected` 不 `public`
- 工具类禁止有 `public` 构造方法
- 循环体内字符串拼接用 `StringBuilder.append()`，不用 `+` 拼接
- getter/setter 方法中不加业务逻辑
