#!/usr/bin/env python3
import argparse
import datetime
import os
import pathlib
import re
import subprocess
import sys
from dataclasses import dataclass
from enum import Enum
from typing import List, Dict, Optional, Tuple


class ReconcileStatus(Enum):
    PASS = "pass"
    WARN = "warn"
    BLOCKED = "blocked"
    AUTOFIX_DONE = "autofix_done"


class CheckResult(Enum):
    OK = "OK"
    MISSING = "MISSING"
    WARN = "WARN"
    BLOCK = "BLOCK"


@dataclass
class ArtifactCheck:
    path: str
    result: CheckResult
    message: str = ""
    size: Optional[str] = None


@dataclass
class BeadsCheck:
    task_id: str
    state_status: str
    beads_status: str
    result: CheckResult


@dataclass
class GitCheck:
    declared_hash: Optional[str]
    actual_hash: Optional[str]
    result: CheckResult


@dataclass
class AutoFixAction:
    description: str
    action: str
    success: bool = False


@dataclass
class BlockItem:
    description: str
    suggestion: str


class ReconcileReport:
    def __init__(self):
        self.timestamp = datetime.datetime.now(datetime.timezone.utc)
        self.current_phase = ""
        self.artifact_checks: List[ArtifactCheck] = []
        self.beads_checks: List[BeadsCheck] = []
        self.git_check: Optional[GitCheck] = None
        self.auto_fixes: List[AutoFixAction] = []
        self.block_items: List[BlockItem] = []
        self.status = ReconcileStatus.PASS

    def add_artifact_check(self, check: ArtifactCheck):
        self.artifact_checks.append(check)
        if check.result == CheckResult.BLOCK:
            self.status = ReconcileStatus.BLOCKED
        elif check.result == CheckResult.MISSING and self.status == ReconcileStatus.PASS:
            self.status = ReconcileStatus.WARN

    def add_beads_check(self, check: BeadsCheck):
        self.beads_checks.append(check)
        if check.result == CheckResult.WARN and self.status == ReconcileStatus.PASS:
            self.status = ReconcileStatus.WARN

    def set_git_check(self, check: GitCheck):
        self.git_check = check
        if check.result == CheckResult.BLOCK:
            self.status = ReconcileStatus.BLOCKED

    def add_auto_fix(self, fix: AutoFixAction):
        self.auto_fixes.append(fix)
        if self.status == ReconcileStatus.PASS:
            self.status = ReconcileStatus.AUTOFIX_DONE

    def add_block_item(self, item: BlockItem):
        self.block_items.append(item)
        self.status = ReconcileStatus.BLOCKED

    def generate_markdown(self) -> str:
        lines = []
        lines.append("# Reconcile Report")
        lines.append("")
        lines.append(f"生成时间：{self.timestamp.strftime('%Y-%m-%dT%H:%M:%SZ')}")
        lines.append(f"当前阶段：{self.current_phase}")
        lines.append(f"状态：{self.status.value}")
        lines.append("")

        lines.append("## 产物校验")
        lines.append("")
        for check in self.artifact_checks:
            prefix = f"[{check.result.value}]"
            if check.size:
                lines.append(f"- {prefix} {check.path} ({check.size})")
            else:
                lines.append(f"- {prefix} {check.path}")
            if check.message:
                lines.append(f"  {check.message}")
        lines.append("")

        lines.append("## Beads 状态")
        lines.append("")
        if self.beads_checks:
            for check in self.beads_checks:
                status_text = f"execution-state={check.state_status}, beads={check.beads_status}"
                prefix = f"[{check.result.value}]"
                lines.append(f"- Task #{check.task_id}: {status_text} {prefix}")
                if check.result == CheckResult.WARN:
                    lines.append("  提示：状态轻微不同步，建议检查")
        else:
            lines.append("- Beads 服务不可用，已跳过检查")
        lines.append("")

        lines.append("## Git 校验")
        lines.append("")
        if self.git_check:
            lines.append(f"- 声明 commit_hash: {self.git_check.declared_hash or '未声明'}")
            lines.append(f"- git log HEAD: {self.git_check.actual_hash or '获取失败'}")
            lines.append(f"  [{self.git_check.result.value}]")
        else:
            lines.append("- 跳过 git 校验")
        lines.append("")

        if self.auto_fixes:
            lines.append("## 自动修复动作")
            lines.append("")
            for fix in self.auto_fixes:
                status = "✅" if fix.success else "⚠️"
                lines.append(f"- {status} [AUTOFIX] {fix.description}")
            lines.append("")

        if self.block_items:
            lines.append("## 需要人工确认")
            lines.append("")
            for item in self.block_items:
                lines.append(f"- [BLOCK] {item.description}")
                lines.append(f"  建议：{item.suggestion}")
            lines.append("")

        return "\n".join(lines)


class ExecutionStateReader:
    def __init__(self, state_file: pathlib.Path):
        self.state_file = state_file
        self.content = ""

    def read(self) -> bool:
        if not self.state_file.exists():
            return False
        self.content = self.state_file.read_text(encoding="utf-8")
        return True

    def get_current_phase(self) -> str:
        match = re.search(r"next_phase\s*\|\s*(\w+)", self.content)
        if match:
            return match.group(1)
        match = re.search(r"current_phase\s*\|\s*(\w+)", self.content)
        if match:
            return match.group(1)
        return "unknown"

    def get_artifact_paths(self) -> Dict[str, str]:
        paths = {}
        # 从上下文表格中提取路径字段
        table_pattern = r"\|\s*(\w+_path)\s*\|\s*([^\|]+?)\s*\|"
        for match in re.finditer(table_pattern, self.content):
            key = match.group(1)
            value = match.group(2).strip()
            if value and value != "—" and value != "-":
                paths[key] = value
        return paths

    def get_commit_hash(self) -> Optional[str]:
        match = re.search(r"commit_hash\s*\|\s*([^\|]+?)\s*\|", self.content)
        if match:
            value = match.group(1).strip()
            if value and value != "—" and value != "-":
                return value
        return None

    def get_reconcile_status(self) -> Optional[str]:
        match = re.search(r"reconcile_status\s*\|\s*([^\|]+?)\s*\|", self.content)
        if match:
            return match.group(1).strip()
        return None

    def update_reconcile_fields(self, status: str, report_path: str):
        timestamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        content = self.content

        if "reconcile_status" in content:
            content = re.sub(
                r"(\| reconcile_status\s*\|\s*)[^\|]*(\s*\|)",
                rf"\1{status}\2",
                content
            )
        else:
            content = self._append_context_field("reconcile_status", status)

        if "last_reconcile_at" in content:
            content = re.sub(
                r"(\| last_reconcile_at\s*\|\s*)[^\|]*(\s*\|)",
                rf"\1{timestamp}\2",
                content
            )
        else:
            content = self._append_context_field("last_reconcile_at", timestamp)

        if "reconcile_report_path" in content:
            content = re.sub(
                r"(\| reconcile_report_path\s*\|\s*)[^\|]*(\s*\|)",
                rf"\1{report_path}\2",
                content
            )
        else:
            content = self._append_context_field("reconcile_report_path", report_path)

        self.content = content
        self.state_file.write_text(content, encoding="utf-8")

    def _append_context_field(self, key: str, value: str) -> str:
        # 在上下文表格末尾（分隔线之前）添加新字段
        lines = self.content.split('\n')
        context_start = -1
        table_end = -1
        
        for i, line in enumerate(lines):
            stripped_line = line.strip()
            if stripped_line == '## 上下文':
                context_start = i
            elif context_start > -1 and table_end == -1:
                stripped = line.strip()
                if stripped.startswith('---') and i > context_start + 3:
                    table_end = i
                    break
        
        if context_start > -1 and table_end > -1:
            lines.insert(table_end, f'| {key} | {value} |')
            return '\n'.join(lines)
        return self.content


class ReconcileEngine:
    def __init__(self, feature_dir: str, auto_fix: bool = False):
        self.feature_dir = pathlib.Path(feature_dir)
        self.state_file = self.feature_dir / "execution-state.md"
        self.report_file = self.feature_dir / ".workflow" / "reconcile-report.md"
        self.auto_fix = auto_fix
        self.report = ReconcileReport()
        self.state_reader = ExecutionStateReader(self.state_file)

    def _check_artifacts(self, artifact_paths: Dict[str, str]) -> List[ArtifactCheck]:
        checks = []
        for key, path_str in artifact_paths.items():
            artifact_path = pathlib.Path(path_str)
            if not artifact_path.is_absolute():
                artifact_path = self.feature_dir / path_str

            if artifact_path.exists():
                if artifact_path.is_file():
                    size_bytes = artifact_path.stat().st_size
                    size_str = self._format_size(size_bytes)
                    checks.append(ArtifactCheck(
                        path=str(artifact_path.relative_to(self.feature_dir)) if artifact_path.is_relative_to(self.feature_dir) else str(artifact_path),
                        result=CheckResult.OK,
                        size=size_str
                    ))
                else:
                    checks.append(ArtifactCheck(
                        path=str(artifact_path.relative_to(self.feature_dir)) if artifact_path.is_relative_to(self.feature_dir) else str(artifact_path),
                        result=CheckResult.OK,
                        message="是目录"
                    ))
            else:
                # 判断是否为关键产物
                if key in ["prd_local_path", "tech_local_path", "mrd_clarified_path", "test_spec_path"]:
                    checks.append(ArtifactCheck(
                        path=str(artifact_path.relative_to(self.feature_dir)) if artifact_path.is_relative_to(self.feature_dir) else str(artifact_path),
                        result=CheckResult.BLOCK,
                        message="核心产物缺失"
                    ))
                else:
                    checks.append(ArtifactCheck(
                        path=str(artifact_path.relative_to(self.feature_dir)) if artifact_path.is_relative_to(self.feature_dir) else str(artifact_path),
                        result=CheckResult.MISSING,
                        message="非关键产物缺失"
                    ))
        return checks

    def _format_size(self, bytes_count: int) -> str:
        if bytes_count < 1024:
            return f"{bytes_count}B"
        elif bytes_count < 1024 * 1024:
            return f"{bytes_count / 1024:.1f}KB"
        else:
            return f"{bytes_count / (1024 * 1024):.1f}MB"

    def _check_beads(self) -> List[BeadsCheck]:
        checks = []
        try:
            bd_bin = os.environ.get("BD_BIN", "bd")
            result = subprocess.run(
                [bd_bin, "list", "--status", "open"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode != 0:
                return checks

            output_lines = result.stdout.strip().split("\n")
            for line in output_lines:
                match = re.match(r"(\d+)\s+(.+?)\s+(\w+)", line)
                if match:
                    task_id = match.group(1)
                    title = match.group(2)
                    beads_status = match.group(3)
                    
                    state_status = "done" if "done" in beads_status.lower() else "in_progress"
                    
                    if beads_status.lower() == "done" and state_status == "done":
                        result = CheckResult.OK
                    else:
                        result = CheckResult.WARN
                    
                    checks.append(BeadsCheck(
                        task_id=task_id,
                        state_status=state_status,
                        beads_status=beads_status,
                        result=result
                    ))
        except Exception:
            pass
        return checks

    def _check_git(self, declared_hash: Optional[str]) -> GitCheck:
        try:
            result = subprocess.run(
                ["git", "log", "--oneline", "-1"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=self.feature_dir
            )
            if result.returncode != 0:
                return GitCheck(
                    declared_hash=declared_hash,
                    actual_hash=None,
                    result=CheckResult.WARN
                )

            actual_hash = result.stdout.strip().split()[0] if result.stdout else None

            if declared_hash and actual_hash:
                if declared_hash.lower() == actual_hash.lower():
                    return GitCheck(
                        declared_hash=declared_hash,
                        actual_hash=actual_hash,
                        result=CheckResult.OK
                    )
                else:
                    return GitCheck(
                        declared_hash=declared_hash,
                        actual_hash=actual_hash,
                        result=CheckResult.BLOCK
                    )
            else:
                return GitCheck(
                    declared_hash=declared_hash,
                    actual_hash=actual_hash,
                    result=CheckResult.OK if not declared_hash else CheckResult.WARN
                )
        except Exception:
            return GitCheck(
                declared_hash=declared_hash,
                actual_hash=None,
                result=CheckResult.WARN
            )

    def _perform_auto_fixes(self, artifact_paths: Dict[str, str]) -> List[AutoFixAction]:
        fixes = []
        if not self.auto_fix:
            return fixes

        for key, path_str in artifact_paths.items():
            artifact_path = pathlib.Path(path_str)
            if not artifact_path.is_absolute():
                artifact_path = self.feature_dir / path_str

            parent_dir = artifact_path.parent
            if not parent_dir.exists():
                try:
                    parent_dir.mkdir(parents=True, exist_ok=True)
                    fixes.append(AutoFixAction(
                        description=f"创建缺失目录: {parent_dir}",
                        action=f"mkdir -p {parent_dir}",
                        success=True
                    ))
                except Exception as e:
                    fixes.append(AutoFixAction(
                        description=f"创建目录失败: {parent_dir} - {str(e)}",
                        action=f"mkdir -p {parent_dir}",
                        success=False
                    ))

        return fixes

    def run(self) -> ReconcileReport:
        if not self.state_reader.read():
            self.report.add_block_item(BlockItem(
                description="execution-state.md 不存在",
                suggestion="请先初始化项目或创建执行状态文件"
            ))
            return self.report

        self.report.current_phase = self.state_reader.get_current_phase()
        artifact_paths = self.state_reader.get_artifact_paths()
        declared_hash = self.state_reader.get_commit_hash()

        artifact_checks = self._check_artifacts(artifact_paths)
        for check in artifact_checks:
            self.report.add_artifact_check(check)

        beads_checks = self._check_beads()
        for check in beads_checks:
            self.report.add_beads_check(check)

        git_check = self._check_git(declared_hash)
        self.report.set_git_check(git_check)

        if self.auto_fix:
            auto_fixes = self._perform_auto_fixes(artifact_paths)
            for fix in auto_fixes:
                self.report.add_auto_fix(fix)

        self.report_file.parent.mkdir(parents=True, exist_ok=True)
        self.report_file.write_text(self.report.generate_markdown(), encoding="utf-8")

        self.state_reader.update_reconcile_fields(
            status=self.report.status.value,
            report_path=str(self.report_file.relative_to(self.feature_dir))
        )

        return self.report

    def print_summary(self, report: ReconcileReport):
        print(f"\n=== Reconcile 结果 ===")
        print(f"状态: {report.status.value}")
        print(f"当前阶段: {report.current_phase}")
        
        if report.status == ReconcileStatus.BLOCKED:
            print("\n❌ 发现高风险不一致，流程已阻断")
            for item in report.block_items:
                print(f"\n  [BLOCK] {item.description}")
                print(f"     建议: {item.suggestion}")
        elif report.status == ReconcileStatus.WARN:
            print("\n⚠️ 发现低风险不一致")
            for check in report.artifact_checks:
                if check.result != CheckResult.OK:
                    print(f"  - {check.path}: {check.result.value}")
        elif report.status == ReconcileStatus.AUTOFIX_DONE:
            print("\n✅ 自动修复完成")
            for fix in report.auto_fixes:
                status = "成功" if fix.success else "失败"
                print(f"  - [{status}] {fix.description}")
        else:
            print("\n✅ 所有校验通过")
        
        print(f"\n报告已写入: {self.report_file}")


def main():
    parser = argparse.ArgumentParser(description="Reconcile 机制 - 四源一致性检查")
    parser.add_argument("--phase", help="指定阶段进行检查")
    parser.add_argument("--fix", action="store_true", help="启用自动修复")
    parser.add_argument("--report-only", action="store_true", help="仅生成报告，不输出摘要")
    parser.add_argument("--feature-dir", default=".", help="feature 目录路径")
    
    args = parser.parse_args()

    engine = ReconcileEngine(feature_dir=args.feature_dir, auto_fix=args.fix)
    report = engine.run()

    if not args.report_only:
        engine.print_summary(report)

    if report.status == ReconcileStatus.BLOCKED:
        sys.exit(1)


if __name__ == "__main__":
    main()