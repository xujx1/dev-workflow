# Java 规范 — 集合处理与并发

> 来源：[飞书 Java 开发规范](https://your-domain.feishu.cn/wiki/CYKww0XMyiNqvUkumwoclvPtn3f)，第4-5章
> 索引：[../\_index.md](../_index.md)

---

## 四、集合处理

**强制**

- 重写 `equals` 必须同时重写 `hashCode`；自定义对象作 Map key 时同上
- `ArrayList.subList()` 不可强转为 `ArrayList`，且不能在持有 subList 期间修改原集合元素数量
- 集合转数组用 `toArray(T[] array)`，不用无参 `toArray()`
- `Arrays.asList()` 返回结果不可调用 `add/remove/clear`
- `foreach` 循环内禁止 `remove/add`，删除用 `Iterator`
- `Comparator` 必须满足自反性、传递性、对称性

**Map null 值规则（高频踩坑）**

| 集合类 | Key | Value | 说明 |
|--------|-----|-------|------|
| Hashtable | 不允许 null | 不允许 null | 线程安全 |
| ConcurrentHashMap | 不允许 null | 不允许 null | 分段锁 |
| TreeMap | 不允许 null | 允许 null | 线程不安全 |
| HashMap | 允许 null | 允许 null | 线程不安全 |

**推荐**

- 集合初始化时指定初始容量：`HashMap` 初始容量 = (元素数 / 0.75) + 1
- 遍历 Map KV 用 `entrySet()`，不用 `keySet()`（后者遍历两次）

---

## 五、并发处理

**强制**

- 线程必须通过线程池创建，禁止手动 `new Thread()`
- 线程池必须用 `ThreadPoolExecutor` 显式创建，禁止用 `Executors`（队列/线程数无界，OOM 风险）
- 创建线程或线程池必须指定有意义的线程名称
- `SimpleDateFormat` 线程不安全，禁止定义为 static；JDK8+ 用 `DateTimeFormatter`
- 锁粒度最小化：能无锁就不加锁，能锁代码块就不锁方法，能用对象锁就不用类锁
- 多资源加锁必须保持一致的加锁顺序，避免死锁
- 并发修改同一记录必须加锁（应用层/缓存/数据库乐观锁任选其一）
- `Timer` 多任务有连锁失败风险，用 `ScheduledExecutorService` 替代

**推荐**

- DCL（双重检查锁）中目标属性必须声明为 `volatile`
- `count++` 操作用 `AtomicInteger`；JDK8 推荐 `LongAdder`
