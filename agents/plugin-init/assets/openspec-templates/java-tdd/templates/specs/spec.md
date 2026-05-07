# 接口契约

## 接口信息

| 属性 | 值 |
|------|-----|
| 接口名称 | {api_name} |
| 请求方法 | {GET/POST/PUT/DELETE} |
| 请求路径 | {/api/v1/path} |
| 内容类型 | application/json |

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| {param} | {type} | 是/否 | {说明} |

### Request Body

```json
{
  "{field}": "{type}",  // {说明}
  "{field}": "{type}"   // {说明}
}
```

## 响应结构

### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "{field}": "{type}"  // {说明}
  }
}
```

### 错误响应

```json
{
  "code": {error_code},
  "message": "{error_message}",
  "data": null
}
```

## 错误码定义

| 错误码 | 说明 | 触发场景 |
|--------|------|---------|
| {code} | {说明} | {场景} |

## 幂等性

- **幂等要求**：{是/否}
- **幂等键**：{requestId / 业务唯一键}

## 示例

### 请求示例

```bash
curl -X POST '{base_url}/api/v1/path' \
  -H 'Content-Type: application/json' \
  -d '{
    "field": "value"
  }'
```

### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 123
  }
}
```
