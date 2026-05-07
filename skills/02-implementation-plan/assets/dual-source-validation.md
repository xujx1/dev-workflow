# 02-implementation-plan — 知识库验证模式

> 由 `SKILL.md` 按需 Read。

---

## 架构

```
MRD ──→ app-knowledge-base (事实基准) ──→ PRD → 技术方案
             ↓ 接口清单/核心逻辑
          以应用库为唯一事实源
```

---

## 完整性检测（Step 0）

- app-knowledge-base/CONTEXT.md 存在 → 继续
- app-kb 不存在 → 阻塞提示：先运行「梳理知识库」或回复「跳过」继续

---

## 冲突解决规则

- 应用知识库为唯一事实源，技术方案与之冲突时以应用库为准
