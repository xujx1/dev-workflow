### 第三步：数据库结构扫描（发现 generatorConfig.xml 时强制执行）

> **触发规则**：检测到 `generatorConfig.xml` → **强制执行**；检测不到 → 跳过，在 `02_架构与设计层.md` 中注明「数据库结构未扫描（未找到 generatorConfig.xml）」。

#### 3.1 探测数据库连接信息

```bash
# 查找 MyBatis Generator 配置（标准 Java 项目约定位置）
find {工程根} -name "generatorConfig.xml" \
  -not -path "*/test/*" | head -3
```

若找到，从 `<jdbcConnection>` 节点提取：
- `connectionURL` → 解析出 `host`、`port`、`dbName`
- `userId` → 数据库用户名
- `password` → 数据库密码

示例节点：
```xml
<jdbcConnection driverClass="com.mysql.cj.jdbc.Driver"
    connectionURL="jdbc:mysql://rm-xxx.mysql.rds.aliyuncs.com:3306/du_tms"
    userId="du_tms"
    password="xxx"/>
```

#### 3.2 选择连接工具（按优先级）

**优先 mysql CLI**：

```bash
which mysql && mysql --version
# 有输出 → 使用 mysql CLI
mysql -h {host} -P {port} -u {user} -p{password} {dbName} \
  -e "SHOW TABLES;" 2>/dev/null | head -20
```

**无 mysql 时用 Python（首选 pymysql）**：

```bash
python3 -c "import pymysql" 2>/dev/null \
  || pip3 install pymysql --quiet
```

```python
import pymysql, json
conn = pymysql.connect(
    host="{host}", port={port},
    user="{user}", password="{password}",
    database="{dbName}", connect_timeout=5
)
cur = conn.cursor()
cur.execute("SHOW TABLES;")
tables = [r[0] for r in cur.fetchall()]
print(f"总表数：{len(tables)}")
print(json.dumps(tables[:50], ensure_ascii=False))
conn.close()
```

**再无法连接时**：跳过此步，标注「数据库结构待补充」。

#### 3.3 核心表结构提取

连接成功后，提取业务核心表结构（关键词匹配：`waybill`、`order`、`carrier`、`track`、`route`、`product`、`config` 等）：

```python
# 按关键词筛选业务核心表（控制在 30 张以内，超出按名称字典序截断）
# 对每张核心表执行：SHOW CREATE TABLE {tableName};
# 提取字段名 + 字段注释 + 索引（禁止将 SHOW CREATE TABLE 原始 DDL 全量粘贴，只保留字段清单表格）
```

> ⚠️ **大表工程约束**（表数 ≥100 时强制执行）：
> - 核心表（关键词命中）≤30 张，写完整字段清单
> - 其余表写「清单摘要」一行（表名 + 一句话业务用途），不写字段详情
> - `db-schema.md` 总行数 ≤400 行
> - 禁止把 SHOW CREATE TABLE 的完整 DDL 原文粘入文档（用字段清单表格替代）

**3步输出（落盘到 `app-knowledge-base/db-schema.md`，此步骤为强制落盘，不可省略）**：

> 产出文件供后续代码生成阶段直接读取，无需重复扫描数据库。
>
> ⚠️ **禁止将 SHOW CREATE TABLE 原始 DDL 全量写入文档**，只保留字段清单表格。

```markdown
# 数据库结构 — {应用名}

> 数据库：{dbName} | 扫描时间：YYYY-MM-DD | 注：{若测试环境则注明}

## 核心业务表（共 N 张）

### {表名}（如 waybill_info）

**业务用途**：{用一句话说明，如「运单主表，记录每笔发货的完整信息」}

| 字段 | 类型 | 业务含义 |
|------|------|---------|
| {字段名} | {类型} | {业务解释} |

**索引**：{主键} / {关键索引，如 idx_waybill_no}

---

## 其余表清单

| 表名 | 业务用途（一句话） |
|------|-----------------|
| {表名} | {业务用途} |
```

总表数：N 张
核心业务表（N张）：
- {表名}：{一句话业务用途}，字段 N 个
- ...
```

> 注意：若数据库为 `dw-dev` / `dw_dev` 等明显测试环境标识，在产出文档中注明「测试环境数据库结构，仅供参考」。

---

