#!/usr/bin/env python3
"""从 _search_docs_items.json 生成飞书 Wiki 搜索结果索引 Markdown（对齐 apm_*_parsed.md 版式）。

JSON 结构示例：
{
  "wikiEntryUrl": "https://...",
  "keyword": "主数据",
  "expectedN": 200,
  "collected": 200,
  "items": [
    {
      "title": "主数据简介",
      "href": "https://poizon.feishu.cn/wiki/...",
      "createdAt": "未展示",
      "updatedAt": "2021年8月30日"
    }
  ]
}

createdAt / updatedAt 可省略，省略时写入「未展示」。
默认始终输出单文件 `_search_docs.md`（不分页）。
"""
from __future__ import annotations

import json
from pathlib import Path

TABLE_HEADER = (
    "| 编号 | 标题 | 链接 | 更新时间 |\n"
    "| --- | --- | --- | --- |"
)


def esc(s: str) -> str:
    return (s or "").replace("|", "\\|").replace("\n", " ").strip()


def fmt_no(i: int, total: int) -> str:
    if total <= 99:
        return f"{i:02d}"
    return f"{i:03d}"


def time_cell(v: object) -> str:
    if v is None or v == "":
        return "未展示"
    return esc(str(v))


def build_table_rows(items: list[dict], start_index: int, total: int) -> list[str]:
    lines: list[str] = [TABLE_HEADER]
    for j, it in enumerate(items, start=start_index):
        no = fmt_no(j, total)
        title = esc(it.get("title", ""))
        href = esc(it.get("href", ""))
        u = time_cell(it.get("updatedAt"))
        lines.append(f"| {no} | {title} | {href} | {u} |")
    return lines


def main() -> None:
    base = Path(__file__).resolve().parent
    src = base / "_search_docs_items.json"
    data = json.loads(src.read_text(encoding="utf-8"))

    wiki = data.get("wikiEntryUrl", "")
    keyword = data.get("keyword", "")
    expected_n = data.get("expectedN", "")
    collected = len(data.get("items", []))
    items: list[dict] = data["items"]

    meta_lines = [
        f"# 飞书 Wiki 搜索结果索引（{keyword}）",
        "",
        f"- **Wiki 入口**：{wiki}",
        f"- **搜索关键词**：{keyword}",
        f"- **页面声明结果数**：{expected_n}",
        f"- **抓取条数（去重）**：{collected}",
    ]

    total = len(items)
    out_main = base / "_search_docs.md"
    body = meta_lines + ["", *build_table_rows(items, 1, total)]
    out_main.write_text("\n".join(body) + "\n", encoding="utf-8")
    print(f"written {out_main} rows={total} (single file)")


if __name__ == "__main__":
    main()
