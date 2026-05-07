# 测试附录

> 仓库级测试规约分片。用于提供测试依赖、`application-test.yml` 与参考文档样例。

---

## 测试工具依赖

```xml
<dependencies>
    <dependency>
        <groupId>junit</groupId>
        <artifactId>junit</artifactId>
        <version>4.13.2</version>
        <scope>test</scope>
    </dependency>

    <dependency>
        <groupId>org.assertj</groupId>
        <artifactId>assertj-core</artifactId>
        <version>3.24.2</version>
        <scope>test</scope>
    </dependency>

    <dependency>
        <groupId>com.mysql</groupId>
        <artifactId>mysql-connector-j</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

---

## 测试配置文件

```yaml
# src/test/resources/application-test.yml
spring:
  profiles:
    active: test

  datasource:
    url: jdbc:mysql://test-db-host:3306/supply_chain_test
    username: ${TEST_DB_USERNAME}
    password: ${TEST_DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver

  data:
    redis:
      host: test-redis-host
      port: 6379
      password: ${TEST_REDIS_PASSWORD:}
      database: 0

  flyway:
    enabled: true
    locations: classpath:db/migration

  test:
    database:
      replace: none

logging:
  level:
    com.supplychain: DEBUG
```

---

## 参考文档

- [JUnit 4 用户指南](https://junit.org/junit4/)
- [AssertJ 文档](https://assertj.github.io/doc/)
- `CLAUDE.md`
