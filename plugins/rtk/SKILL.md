---
name: rtk-setup
version: v1.0.0
description: 安装 RTK (Token Killer) token 压缩。自动压缩 git/grep/ls 等命令输出，节省 57-78% token。当用户说"安装RTK"、"Token压缩"、"安装token优化"时触发。
user-invocable: true
---

# RTK Token 压缩安装

> RTK（Rust Token Killer）是 AI Coding 的 token 压缩层，自动压缩 Claude Code 使用的
> git/grep/ls/find 等命令输出，节省 57-78% token 消耗。

---

## 前置检查

```bash
rtk gain 2>/dev/null && echo "RTK_OK" || echo "RTK_MISSING"
rtk --version 2>/dev/null || echo "VERSION_UNKNOWN"
```

**若 RTK_OK**：已安装，直接初始化：
```bash
rtk init --global
rtk gain
```

**若 RTK_MISSING**：
```
❌ RTK 未安装。

安装方式：
  brew install rtk

安装完成后重新说"安装RTK"，或手动执行：
  rtk init --global
```

---

## 安装步骤

```bash
# 1. 初始化全局 hook（让 Claude Code 的 bash 命令自动走 rtk 代理）
rtk init --global

# 2. 验证安装
rtk gain
rtk --version
```

**成功输出示例**：
```
✅ RTK Token 压缩已启用

版本：rtk X.Y.Z
压缩模式：全局（所有 Claude Code 会话生效）
预期节省：git/grep/ls 输出 57-78%

📌 需重启 Claude Code 使 hook 生效
```

---

## 验证命令

```bash
rtk gain              # 查看 token 节省统计
rtk gain --history    # 查看历史节省记录
which rtk             # 确认安装路径
```

> ⚠️ 名称冲突：若 `rtk gain` 报错，可能安装的是 reachingforthejack/rtk（Rust Type Kit）。
