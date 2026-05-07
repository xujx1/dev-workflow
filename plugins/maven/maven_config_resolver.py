#!/usr/bin/env python3
"""
Resolve Maven command/settings/local repository for the current project
without hardcoding a single user's local paths.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import shlex
import shutil
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


def expand_path(value: Optional[str], project_root: Optional[Path] = None) -> str:
    if not value:
        return ""
    normalized = value.strip()
    normalized = normalized.replace("$USER_HOME$", str(Path.home()))
    if project_root is not None:
        normalized = normalized.replace("$PROJECT_DIR$", str(project_root))
    return os.path.expandvars(os.path.expanduser(normalized))


def safe_exists(path: str) -> bool:
    return bool(path) and Path(path).exists()


def is_healthy_java_home(path: str) -> bool:
    if not path:
        return False

    java_bin = Path(path) / "bin/java"
    if not java_bin.exists() or not os.access(java_bin, os.X_OK):
        return False

    try:
        proc = subprocess.run(
            [str(java_bin), "-version"],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except Exception:
        return False

    return proc.returncode == 0


def normalize_maven_home(raw_value: str, bundled_maven_bin: str, project_root: Path) -> str:
    value = expand_path(raw_value, project_root)
    if not value:
        return ""

    upper_value = value.upper()
    if upper_value.startswith("BUNDLED"):
        return str(Path(bundled_maven_bin).resolve().parent.parent) if bundled_maven_bin else ""

    candidate = Path(value)
    if candidate.is_file() and candidate.name == "mvn":
        return str(candidate.resolve().parent.parent)

    return str(candidate.resolve()) if candidate.exists() else value


def detect_bundled_maven_bin() -> str:
    candidates: List[Path] = []

    mac_apps = [
        Path("/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn"),
        Path("/Applications/IntelliJ IDEA CE.app/Contents/plugins/maven/lib/maven3/bin/mvn"),
    ]
    candidates.extend(mac_apps)

    app_root = Path("/Applications")
    if app_root.exists():
        candidates.extend(sorted(app_root.glob("*.app/Contents/plugins/maven/lib/maven3/bin/mvn")))

    for path in candidates:
        if path.exists():
            return str(path)
    return ""


def idea_options_dirs() -> List[Path]:
    system = platform.system().lower()
    if system == "darwin":
        base = Path.home() / "Library/Application Support/JetBrains"
    elif system == "linux":
        base = Path.home() / ".config/JetBrains"
    else:
        appdata = os.environ.get("APPDATA", "")
        base = Path(appdata) / "JetBrains" if appdata else Path()

    if not base.exists():
        return []

    dirs = [p / "options" for p in base.iterdir() if p.is_dir() and (p.name.startswith("IntelliJIdea") or p.name.startswith("IdeaIC"))]
    return sorted((d for d in dirs if d.exists()), key=lambda item: item.parent.name)


def parse_maven_component_options(xml_path: Path) -> Dict[str, str]:
    if not xml_path.exists():
        return {}

    try:
        root = ET.parse(xml_path).getroot()
    except ET.ParseError:
        return {}

    result: Dict[str, str] = {}
    for comp in root.iter("component"):
        comp_name = comp.get("name", "")
        if "maven" not in comp_name.lower():
            continue
        for opt in comp.iter("option"):
            key = opt.get("name", "").strip()
            value = opt.get("value", "").strip()
            if key:
                result[key] = value
    return result


def parse_jdk_table(jdk_table_path: Path) -> List[Dict[str, str]]:
    if not jdk_table_path.exists():
        return []

    try:
        root = ET.parse(jdk_table_path).getroot()
    except ET.ParseError:
        return []

    result: List[Dict[str, str]] = []
    for jdk in root.iter("jdk"):
        name = jdk.find(".//name")
        home = jdk.find(".//homePath")
        version = jdk.find(".//version")
        result.append(
            {
                "name": name.get("value", "") if name is not None else "",
                "path": expand_path(home.get("value", "")) if home is not None else "",
                "version": version.get("value", "") if version is not None else "",
            }
        )
    return result


def parse_project_jdk_name(misc_xml: Path) -> str:
    if not misc_xml.exists():
        return ""

    try:
        root = ET.parse(misc_xml).getroot()
    except ET.ParseError:
        return ""

    for comp in root.iter("component"):
        if comp.get("name") == "ProjectRootManager":
            return comp.get("project-jdk-name", "")
    return ""


def alias_lookup(data: Dict[str, str], keys: Iterable[str]) -> str:
    if not data:
        return ""
    lowered = {k.lower(): v for k, v in data.items() if k}
    for key in keys:
        value = lowered.get(key.lower(), "")
        if value:
            return value
    return ""


def parse_maven_config(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}

    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        lines.append(stripped)

    if not lines:
        return {}

    tokens = shlex.split(" ".join(lines))
    result: Dict[str, str] = {}
    idx = 0
    while idx < len(tokens):
        token = tokens[idx]
        next_token = tokens[idx + 1] if idx + 1 < len(tokens) else ""

        if token in {"-s", "--settings"} and next_token:
            result["userSettingsFile"] = next_token
            idx += 2
            continue
        if token.startswith("--settings="):
            result["userSettingsFile"] = token.split("=", 1)[1]
        elif token in {"-gs", "--global-settings"} and next_token:
            result["globalSettingsFile"] = next_token
            idx += 2
            continue
        elif token.startswith("--global-settings="):
            result["globalSettingsFile"] = token.split("=", 1)[1]
        elif token.startswith("-Dmaven.repo.local="):
            result["localRepository"] = token.split("=", 1)[1]
        idx += 1

    return result


def parse_settings_local_repo(settings_file: str, project_root: Path) -> str:
    path = Path(expand_path(settings_file, project_root))
    if not path.exists():
        return ""

    try:
        root = ET.parse(path).getroot()
    except ET.ParseError:
        return ""

    for tag in root.iter():
        if tag.tag.endswith("localRepository") and (tag.text or "").strip():
            return expand_path(tag.text or "")
    return ""


def inspect_maven_command(maven_cmd: str, project_root: Path, preferred_java_home: str) -> Tuple[bool, str]:
    if not maven_cmd:
        return False, ""

    env = os.environ.copy()
    if preferred_java_home and safe_exists(preferred_java_home):
        env["JAVA_HOME"] = preferred_java_home
        env["PATH"] = f"{preferred_java_home}/bin:{env.get('PATH', '')}"

    try:
        proc = subprocess.run(
            [maven_cmd, "-version"],
            check=False,
            capture_output=True,
            text=True,
            timeout=15,
            cwd=str(project_root),
            env=env,
        )
    except Exception:
        return False, ""

    output = (proc.stdout or proc.stderr or "").strip().splitlines()
    first_line = output[0].strip() if output else ""
    return proc.returncode == 0, first_line


def resolve_maven_command(
    project_root: Path,
    project_cfg: Dict[str, str],
    global_cfg: Dict[str, str],
    bundled_maven_bin: str,
    preferred_java_home: str,
) -> Tuple[str, str, str, str, bool]:
    candidates: List[Tuple[str, str, str]] = []

    mvnw = project_root / "mvnw"
    if mvnw.exists():
        candidates.append(("./mvnw", "wrapper", str(mvnw)))

    project_home = normalize_maven_home(
        alias_lookup(project_cfg, ["mavenHome", "generalSettings.mavenHome"]),
        bundled_maven_bin,
        project_root,
    )
    project_bin = Path(project_home) / "bin/mvn" if project_home else None
    if project_home and project_bin and project_bin.exists():
        candidates.append((str(project_bin), "idea-project", project_home))

    global_home = normalize_maven_home(
        alias_lookup(global_cfg, ["mavenHome", "generalSettings.mavenHome"]),
        bundled_maven_bin,
        project_root,
    )
    global_bin = Path(global_home) / "bin/mvn" if global_home else None
    if global_home and global_bin and global_bin.exists():
        candidates.append((str(global_bin), "idea-global", global_home))

    path_mvn = shutil.which("mvn") or ""
    if path_mvn:
        candidates.append((path_mvn, "system", str(Path(path_mvn).resolve().parent.parent)))

    if bundled_maven_bin:
        bundled_home = str(Path(bundled_maven_bin).resolve().parent.parent)
        candidates.append((bundled_maven_bin, "bundled", bundled_home))

    fallback: Optional[Tuple[str, str, str, str, bool]] = None
    for command, source, home in candidates:
        healthy, version = inspect_maven_command(command, project_root, preferred_java_home)
        if fallback is None:
            fallback = (command, source, home, version, healthy)
        if healthy:
            return command, source, home, version, True

    if fallback is not None:
        return fallback

    return "", "not-found", "", "", False


def resolve(project_root: Path) -> Dict[str, object]:
    bundled_maven_bin = detect_bundled_maven_bin()
    idea_dirs = idea_options_dirs()
    latest_idea_dir = idea_dirs[-1] if idea_dirs else None

    project_workspace = project_root / ".idea/workspace.xml"
    project_misc = project_root / ".idea/misc.xml"
    global_project_default = latest_idea_dir / "project.default.xml" if latest_idea_dir else Path()
    jdk_table = latest_idea_dir / "jdk.table.xml" if latest_idea_dir else Path()
    project_maven_config = project_root / ".mvn/maven.config"

    project_cfg = parse_maven_component_options(project_workspace)
    global_cfg = parse_maven_component_options(global_project_default) if latest_idea_dir else {}
    maven_config_cfg = parse_maven_config(project_maven_config)
    jdk_list = parse_jdk_table(jdk_table) if latest_idea_dir else []
    project_jdk_name = parse_project_jdk_name(project_misc)

    preferred_java_home = ""
    if project_jdk_name:
        for jdk in jdk_list:
            if jdk.get("name") == project_jdk_name and is_healthy_java_home(jdk.get("path", "")):
                preferred_java_home = jdk.get("path", "")
                break
    if not preferred_java_home:
        for jdk in jdk_list:
            if is_healthy_java_home(jdk.get("path", "")):
                preferred_java_home = jdk.get("path", "")
                break
    if not preferred_java_home:
        env_java_home = expand_path(os.environ.get("JAVA_HOME", ""), project_root)
        preferred_java_home = env_java_home if is_healthy_java_home(env_java_home) else ""

    user_settings_file = expand_path(
        alias_lookup(maven_config_cfg, ["userSettingsFile"])
        or alias_lookup(project_cfg, ["userSettingsFile", "generalSettings.userSettingsFile"])
        or alias_lookup(global_cfg, ["userSettingsFile", "generalSettings.userSettingsFile"])
        or str(Path.home() / ".m2/settings.xml"),
        project_root,
    )

    global_settings_file = expand_path(
        alias_lookup(maven_config_cfg, ["globalSettingsFile"])
        or alias_lookup(project_cfg, ["globalSettingsFile", "generalSettings.globalSettingsFile"])
        or alias_lookup(global_cfg, ["globalSettingsFile", "generalSettings.globalSettingsFile"]),
        project_root,
    )

    local_repository = expand_path(
        alias_lookup(maven_config_cfg, ["localRepository"])
        or alias_lookup(project_cfg, ["overriddenLocalRepository", "localRepository", "generalSettings.localRepository"])
        or alias_lookup(global_cfg, ["overriddenLocalRepository", "localRepository", "generalSettings.localRepository"]),
        project_root,
    )

    if not local_repository and user_settings_file:
        local_repository = parse_settings_local_repo(user_settings_file, project_root)
    if not local_repository and global_settings_file:
        local_repository = parse_settings_local_repo(global_settings_file, project_root)
    if not local_repository:
        local_repository = str(Path.home() / ".m2/repository")

    maven_cmd, command_source, maven_home, maven_version, command_healthy = resolve_maven_command(
        project_root, project_cfg, global_cfg, bundled_maven_bin, preferred_java_home
    )

    source_chain = []
    if project_maven_config.exists():
        source_chain.append(".mvn/maven.config")
    if project_workspace.exists():
        source_chain.append(".idea/workspace.xml")
    if latest_idea_dir and global_project_default.exists():
        source_chain.append(f"{latest_idea_dir.parent.name}/options/project.default.xml")
    if safe_exists(user_settings_file):
        source_chain.append(user_settings_file)
    else:
        source_chain.append("default ~/.m2")

    return {
        "project_root": str(project_root),
        "idea_version": latest_idea_dir.parent.name if latest_idea_dir else "",
        "project_jdk_name": project_jdk_name,
        "preferred_java_home": preferred_java_home,
        "source_chain": source_chain,
        "command_source": command_source,
        "command_healthy": command_healthy,
        "maven_command": maven_cmd,
        "maven_version": maven_version,
        "maven_home": maven_home,
        "bundled_maven_bin": bundled_maven_bin,
        "user_settings_file": user_settings_file,
        "user_settings_exists": safe_exists(user_settings_file),
        "global_settings_file": global_settings_file,
        "global_settings_exists": safe_exists(global_settings_file),
        "local_repository": local_repository,
        "local_repository_exists": safe_exists(local_repository),
        "project_maven_config": str(project_maven_config) if project_maven_config.exists() else "",
        "project_workspace_file": str(project_workspace) if project_workspace.exists() else "",
        "project_config": project_cfg,
        "global_config": global_cfg,
        "maven_config_file_options": maven_config_cfg,
    }


def to_text(data: Dict[str, object]) -> str:
    lines = [
        "Maven 解析结果",
        f"  IDEA 版本目录: {data.get('idea_version') or '未检测到'}",
        f"  解析来源: {' -> '.join(data.get('source_chain', []))}",
        f"  Maven 命令: {data.get('maven_command') or '未找到'}",
        f"  Maven 版本: {data.get('maven_version') or '未检测到'}",
        f"  Maven Home: {data.get('maven_home') or '未解析'}",
        f"  命令来源: {data.get('command_source') or '未知'}",
        f"  用户设置文件: {data.get('user_settings_file') or '未解析'}",
        f"  用户设置文件存在: {'是' if data.get('user_settings_exists') else '否'}",
        f"  全局 settings: {data.get('global_settings_file') or '未配置'}",
        f"  本地 Maven 仓库: {data.get('local_repository') or '未解析'}",
        f"  本地 Maven 仓库存在: {'是' if data.get('local_repository_exists') else '否'}",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", default=os.getcwd())
    parser.add_argument("--format", choices=["json", "text"], default="json")
    args = parser.parse_args()

    result = resolve(Path(args.project_root).resolve())
    if args.format == "text":
        print(to_text(result))
    else:
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
