#!/usr/bin/env python3
"""
知识库拆分脚本
将原来的大文档拆分为按层级组织的小文档
用法：
  python3 kb-splitter.py --api-dir <接口文档目录> --kb-out <知识库输出目录>
"""
import argparse
import os
import re
from datetime import datetime


def display_title_from_kb_out(kb_out):
    """概览标题：统一输出目录 app-kb 时用「应用知识库」；否则用路径最后一级目录名。"""
    base = os.path.basename(os.path.abspath(kb_out.rstrip(os.sep)))
    if not base or base in (".", ".."):
        return "应用知识库"
    if base == "app-kb":
        return "应用知识库"
    return base


def extract_top_interfaces(api_dir, n=10):
    """提取前N个高频接口信息"""
    api_files = sorted([
        f for f in os.listdir(api_dir)
        if f.endswith('.md') and '_' in f
    ])

    interfaces = []
    for fname in api_files[:n]:
        num = fname.split('_')[0]
        with open(os.path.join(api_dir, fname), 'r', encoding='utf-8') as f:
            content = f.read()

        # 提取接口名（第一行 # 标题）
        title_match = re.search(r'^# (.+)$', content, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else fname.replace('.md', '')

        # 提取接口类型
        type_match = re.search(r'接口类型[：:]\s*(.+)', content)
        itype = type_match.group(1).strip() if type_match else '-'
        # 归一化
        if 'HTTP' in itype.upper() or 'http' in itype:
            itype = 'HTTP'
        elif 'Dubbo' in itype or 'dubbo' in itype:
            itype = 'Dubbo'

        # 提取 QPS
        qps_match = re.search(r'峰值QPS[：:]\s*([\d.]+)', content)
        peak_qps = qps_match.group(1) if qps_match else '-'

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

        interfaces.append({
            'num': num,
            'title': title,
            'type': itype,
            'peak_qps': peak_qps,
            'p99': p99,
            'purpose': purpose,
        })

    return interfaces


def build_interface_index_table(interfaces):
    """生成接口索引 Markdown 表格"""
    rows = ['| 编号 | 接口名称 | 类型 | 峰值QPS | 99线RT | 核心用途 |',
            '|------|---------|------|--------|--------|---------|']
    for info in interfaces:
        rows.append(
            f"| {info['num']} | {info['title']} | {info['type']} | "
            f"{info['peak_qps']} | {info['p99']} | {info['purpose']} |"
        )
    return '\n'.join(rows)


def main():
    parser = argparse.ArgumentParser(description='拆分生成应用知识库文档')
    parser.add_argument('--api-dir', required=True, help='单接口文档目录')
    parser.add_argument('--kb-out', required=True, help='知识库输出目录')
    args = parser.parse_args()

    display_title = display_title_from_kb_out(args.kb_out)

    # 提取高频接口
    top_interfaces = extract_top_interfaces(args.api_dir, 10)

    # 确保输出目录存在
    os.makedirs(args.kb_out, exist_ok=True)

    # 生成 00_概览.md
    index_table = build_interface_index_table(top_interfaces)
    today = datetime.now().strftime('%Y-%m')

    overview_content = f"""# {display_title} - 概览

> 整理时间：{today}
> 覆盖范围：系统架构 + 业务全景 + {len([f for f in os.listdir(args.api_dir) if f.endswith('.md')])}个对外接口详细文档

## 知识库导航

### 文件索引
- 00_概览.md - 知识库导航 + 高频接口 + 文件索引
- 01_业务与领域知识层.md - 服务定位 / 域全景 / 领域模型 / 术语表
- 02_架构与设计层.md - DDD 结构 / 接口清单 / 表设计 / 外部依赖
- 03_核心流程与逻辑层.md - 核心流程 / MQ 消费者 / 定时任务 / 状态机
- 04_工程与规范层.md - 异常体系 / 代码规范 / 配置项
- 05_演进与决策记录层.md - ADR / 技术债务 / 演进路线
- api-docs/ - 每个接口一个 Markdown 文件

### 高频接口（Top 10）

{index_table}

### 系统定位

在这里填写系统定位信息（从飞书文档中提取）

### 联系方式

- 负责人：相关团队
- 业务领域：业务领域描述
"""

    with open(os.path.join(args.kb_out, '00_概览.md'), 'w', encoding='utf-8') as f:
        f.write(overview_content)

    print(f'知识库概览文档已生成：{os.path.join(args.kb_out, "00_概览.md")}')


if __name__ == '__main__':
    main()