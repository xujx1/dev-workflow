---
name: mysql-dba
description: MySQL 慢查询分析、索引优化、Migration 审查速查手册。当需要分析 SQL 性能、设计索引、审查 DDL 变更时使用。
---

# MySQL DBA 规范（浓缩索引）

---

## 快速诊断流程

```sql
-- 1. EXPLAIN 分析执行计划
EXPLAIN SELECT ...;

-- 2. 关注字段
--    type: ALL → 全表扫描（危险）
--    type: ref/range → 走索引（健康）
--    rows: 行数越少越好
--    Extra: Using filesort / Using temporary → 需优化

-- 3. 查看表索引
SHOW INDEX FROM {table};

-- 4. MySQL 8.0+ 查索引使用情况
SELECT * FROM sys.schema_unused_indexes WHERE object_schema = '{db}';
```

---

## 常见问题 → 修复

| 问题 | EXPLAIN 特征 | 修复 |
|------|-------------|------|
| 全表扫描 | `type=ALL` | WHERE / ORDER BY 字段加索引 |
| 索引失效—函数 | `type=ALL` 但有索引 | 去掉字段上的函数包裹 |
| 索引失效—类型 | 隐式转换警告 | 保持 WHERE 值类型与字段类型一致 |
| 索引失效—LIKE | `%keyword` | 改为 `keyword%` 或全文索引 |
| N+1 查询 | 循环内 SELECT | 改 IN 批量查询 |
| 深度分页 | `LIMIT 100000,10` 慢 | 游标分页：`WHERE id > last_id LIMIT 10` |
| 大结果集 | rows 极大 | 加 LIMIT，考虑分页或流式处理 |
| 超 3 表 JOIN | 执行计划复杂 | 拆分查询 / 冗余字段 |

---

## 索引设计原则

```
最左前缀原则  复合索引按 (区分度高 → 区分度低) 排序
区分度        性别/状态字段不单独建索引（区分度 < 10%）
覆盖索引      SELECT 字段全在索引中 → 避免回表
索引数量      单表 ≤ 5 个索引，写多读少表减少索引
更新代价      高频更新字段慎建索引
```

---

## Migration 审查清单

```
必须  表必备：id（主键）、create_time、update_time
推荐  软删除字段：is_del TINYINT DEFAULT 0
必须  大表 DDL 用 pt-osc 或 gh-ost（避免锁表）
必须  新增索引语句评估锁表风险
必须  必须有对应回滚脚本
必须  字段名 snake_case，不用保留字
```

---

## 生产安全约束

```
只允许  SELECT / EXPLAIN / SHOW / DESCRIBE
禁止    UPDATE / INSERT / DELETE / DROP / ALTER（生产环境）
禁止    DELETE FROM {table}（无 WHERE 条件）
必须    数据修复脚本先在测试环境跑通，再提 DBA 审批
```

---

## 性能基准参考（Java 服务）

| 指标 | 建议值 | 告警阈值 |
|------|--------|---------|
| 慢查询阈值 | 500ms | 1000ms |
| 单次查询行数 | < 1000 | > 10000 |
| 事务持锁时间 | < 100ms | > 500ms |
| 索引区分度 | > 10% | < 1% |

---
