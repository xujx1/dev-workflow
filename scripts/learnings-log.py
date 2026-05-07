#!/usr/bin/env python3
"""
Learnings 记录工具 - 轻量级实现
用于记录项目级别的学习，支持去重和追加
"""

import json
import sys
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

def get_learnings_file(project_root: str) -> Path:
    """获取 learnings.jsonl 文件路径"""
    kb_dir = Path(project_root) / "app-knowledge-base"
    kb_dir.mkdir(parents=True, exist_ok=True)
    return kb_dir / "learnings.jsonl"

def log_learning(
    learnings_file: Path,
    skill: str,
    learning_type: str,
    key: str,
    insight: str,
    confidence: int = 5,
    source: str = "observed",
    files: Optional[list[str]] = None
) -> bool:
    """记录一条学习"""
    entry = {
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "skill": skill,
        "type": learning_type,
        "key": key,
        "insight": insight,
        "confidence": min(10, max(1, confidence)),
        "source": source,
        "files": files or []
    }

    # 追加写入（append-only，最新条目优先）
    with open(learnings_file, 'a') as f:
        f.write(json.dumps(entry, ensure_ascii=False) + '\n')

    return True

def main():
    parser = argparse.ArgumentParser(description='Log a project learning')
    parser.add_argument('--project-root', default='.', help='Project root directory')
    parser.add_argument('--skill', required=True, help='Skill that generated this learning')
    parser.add_argument('--type', '-t', required=True,
                        choices=['pattern', 'pitfall', 'preference', 'architecture', 'operational'],
                        help='Type of learning')
    parser.add_argument('--key', '-k', required=True, help='Short key (2-5 words, kebab-case)')
    parser.add_argument('--insight', '-i', required=True, help='The insight (one sentence)')
    parser.add_argument('--confidence', '-c', type=int, default=5, help='Confidence level (1-10)')
    parser.add_argument('--source', '-s', default='observed',
                        choices=['observed', 'user-stated', 'inferred'],
                        help='Source of this learning')
    parser.add_argument('--files', '-f', nargs='*', help='Related files')

    args = parser.parse_args()

    learnings_file = get_learnings_file(args.project_root)
    success = log_learning(
        learnings_file,
        skill=args.skill,
        learning_type=args.type,
        key=args.key,
        insight=args.insight,
        confidence=args.confidence,
        source=args.source,
        files=args.files
    )

    if success:
        print(f"Logged: [{args.type}] {args.key}")
        return 0
    else:
        print("Failed to log learning", file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
