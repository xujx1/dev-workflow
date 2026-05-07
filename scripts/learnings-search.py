#!/usr/bin/env python3
"""
Learnings 搜索工具 - 轻量级实现
用于搜索项目级别的学习记录，支持关键词搜索和置信度过滤
"""

import json
import sys
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional

def get_learnings_file(project_root: str) -> Path:
    """获取 learnings.jsonl 文件路径"""
    return Path(project_root) / "app-knowledge-base" / "learnings.jsonl"

def search_learnings(
    learnings_file: Path,
    query: Optional[str] = None,
    limit: int = 10,
    min_confidence: float = 0.0,
    learning_type: Optional[str] = None
) -> list[dict]:
    """搜索 learnings，支持关键词、置信度、类型过滤"""
    if not learnings_file.exists():
        return []

    results = []
    query_lower = query.lower() if query else None

    with open(learnings_file, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            # 置信度过滤
            if entry.get('confidence', 0) < min_confidence:
                continue

            # 类型过滤
            if learning_type and entry.get('type') != learning_type:
                continue

            # 关键词搜索
            if query_lower:
                searchable = f"{entry.get('key', '')} {entry.get('insight', '')} {entry.get('skill', '')}".lower()
                if query_lower not in searchable:
                    continue

            results.append(entry)

    # 按时间倒序排序（最新的在前）
    results.sort(key=lambda x: x.get('ts', ''), reverse=True)

    return results[:limit]

def format_output(entries: list[dict], format_type: str = 'text') -> str:
    """格式化输出"""
    if not entries:
        return "No learnings found."

    if format_type == 'json':
        return json.dumps(entries, indent=2, ensure_ascii=False)

    lines = []
    for entry in entries:
        ts = entry.get('ts', 'unknown')
        skill = entry.get('skill', 'unknown')
        ltype = entry.get('type', 'unknown')
        key = entry.get('key', 'unknown')
        insight = entry.get('insight', '')
        confidence = entry.get('confidence', 0)
        files = entry.get('files', [])

        lines.append(f"[{ts}] [{skill}] [{ltype}]")
        lines.append(f"  Key: {key}")
        lines.append(f"  Insight: {insight}")
        lines.append(f"  Confidence: {confidence}/10")
        if files:
            lines.append(f"  Files: {', '.join(files)}")
        lines.append("")

    return "\n".join(lines)

def main():
    parser = argparse.ArgumentParser(description='Search project learnings')
    parser.add_argument('--project-root', default='.', help='Project root directory')
    parser.add_argument('--query', '-q', help='Search query')
    parser.add_argument('--limit', '-n', type=int, default=10, help='Max results')
    parser.add_argument('--min-confidence', '-c', type=float, default=0.0, help='Min confidence (0-10)')
    parser.add_argument('--type', '-t', choices=['pattern', 'pitfall', 'preference', 'architecture', 'operational'], help='Filter by type')
    parser.add_argument('--format', '-f', choices=['text', 'json'], default='text', help='Output format')

    args = parser.parse_args()

    learnings_file = get_learnings_file(args.project_root)
    results = search_learnings(
        learnings_file,
        query=args.query,
        limit=args.limit,
        min_confidence=args.min_confidence,
        learning_type=args.type
    )

    print(format_output(results, args.format))

if __name__ == '__main__':
    main()
