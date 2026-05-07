#!/usr/bin/env python3
"""
知识库合并脚本
用法：
  python3 kb-merge.py --arch <架构文档路径> --api-dir <接口文档目录> --output <输出路径>
"""
import argparse
import os
import re
from datetime import datetime


def parse_api_file(filepath):
    """从单接口文档中提取基本信息，用于生成索引表"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 提取接口名（第一行 # 标题）
    title_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else os.path.basename(filepath)

    # 提取接口类型
    type_match = re.search(r'接口类型[：:]\s*(.+)', content)
    itype = type_match.group(1).strip() if type_match else '-'
    # 归一化
    if 'HTTP' in itype.upper() or 'http' in itype:
        itype = 'HTTP'
    elif 'Dubbo' in itype or 'dubbo' in itype:
        itype = 'Dubbo'

    # 提取 QPS
    qps_match = re.search(r'瞬时QPS[：:]\s*([\d.]+)', content)
    instant_qps = qps_match.group(1) if qps_match else '-'

    peak_match = re.search(r'峰值QPS[：:]\s*([\d.]+)', content)
    peak_qps = peak_match.group(1) if peak_match else '-'

    # 提取 P99
    p99_match = re.search(r'99线RT[：:]\s*(.+)', content)
    if not p99_match:
        p99_match = re.search(r'P99[：:]\s*(.+)', content)
    p99 = p99_match.group(1).strip() if p99_match else '-'

    # 提取接口作用（第一段正文）
    purpose_match = re.search(r'## 接口作用\n+(.+?)(?=\n##|\Z)', content, re.DOTALL)
    purpose = ''
    if purpose_match:
        purpose = purpose_match.group(1).strip().split('\n')[0][:50]  # 取第一行，最多50字

    return {
        'title': title,
        'type': itype,
        'instant_qps': instant_qps,
        'peak_qps': peak_qps,
        'p99': p99,
        'purpose': purpose,
    }


def build_index_table(api_files_with_num):
    """生成接口索引 Markdown 表格"""
    rows = ['| 编号 | 接口名称 | 类型 | 瞬时QPS | 峰值QPS | 99线RT | 核心用途 |',
            '|------|---------|------|--------|--------|--------|---------|']
    for num, fpath in api_files_with_num:
        info = parse_api_file(fpath)
        rows.append(
            f"| {num} | {info['title']} | {info['type']} | "
            f"{info['instant_qps']} | {info['peak_qps']} | {info['p99']} | {info['purpose']} |"
        )
    return '\n'.join(rows)


def main():
    parser = argparse.ArgumentParser(description='合并生成应用知识库主文档')
    parser.add_argument('--arch', required=True, help='业务架构总结文档路径')
    parser.add_argument('--api-dir', required=True, help='单接口文档目录')
    parser.add_argument('--output', required=True, help='输出知识库文档路径')
    parser.add_argument('--title', default='应用知识库', help='系统名称（用于文档标题）')
    args = parser.parse_args()

    # 读取架构文档
    with open(args.arch, 'r', encoding='utf-8') as f:
        arch_content = f.read()

    # 读取所有接口文档，按文件名排序
    api_files = sorted([
        f for f in os.listdir(args.api_dir)
        if f.endswith('.md')
    ])
    api_files_with_num = []
    for fname in api_files:
        num = fname.split('_')[0]
        api_files_with_num.append((num, os.path.join(args.api_dir, fname)))

    total = len(api_files_with_num)
    today = datetime.now().strftime('%Y-%m')

    # 构建索引表
    index_table = build_index_table(api_files_with_num)

    # 构建接口详细内容
    api_details = ''
    for num, fpath in api_files_with_num:
        fname = os.path.basename(fpath)
        title_part = fname.replace('.md', '')
        api_details += f'\n---\n\n## 接口{num}：{title_part}\n\n'
        with open(fpath, 'r', encoding='utf-8') as f:
            api_details += f.read()
        api_details += '\n'

    # 组装最终文档
    system_name = os.path.basename(args.output).replace('知识库.md', '').replace('.md', '')
    full_content = f"""# {system_name}应用知识库

> 整理时间：{today}
> 覆盖范围：系统架构 + 业务全景 + {total}个对外接口详细文档

---

# 第一部分：系统架构与业务全景

{arch_content}

---

# 第二部分：接口全量索引（{total}个接口，按QPS从高到低）

{index_table}

---

# 第三部分：接口详细文档

{api_details}
"""

    # 确保输出目录存在
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(full_content)

    size = os.path.getsize(args.output)
    print(f'知识库文档已生成：{args.output}')
    print(f'文件大小：{size:,} bytes ({size / 1024:.1f} KB)')
    print(f'接口总数：{total}')


if __name__ == '__main__':
    main()
