#!/usr/bin/env node
/**
 * config-resolver.js — 三层配置合并器
 *
 * 功能：
 * 1. 加载三层配置：org -> workspace -> project
 * 2. 按优先级合并（project > workspace > org）
 * 3. 处理 locked 字段不可被低层覆盖
 * 4. 输出 resolved-config.json（带来源注释）
 *
 * 用法：
 *   node config-resolver.js [--dry-run] [--output <path>]
 *
 * 配置路径约定：
 *   org:       ~/.config/mrd-to-code/org-config.json 或 {org-repo}/.mrd-to-code-org.json
 *   workspace: {monorepo-root}/.mrd-to-code-workspace.json
 *   project:   {project-dir}/.mrd-to-code-config.json
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ARG_DRY_RUN = process.argv.includes('--dry-run');
const ARG_OUTPUT_IDX = process.argv.indexOf('--output');
const OUTPUT_PATH = ARG_OUTPUT_IDX !== -1 ? process.argv[ARG_OUTPUT_IDX + 1] : null;

// ---- 路径解析 -------------------------------------------------------

function expandHome(filePath) {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function findOrgConfig() {
  // 优先级1: ~/.config/mrd-to-code/org-config.json
  const localPath = expandHome('~/.config/mrd-to-code/org-config.json');
  if (fs.existsSync(localPath)) return localPath;

  // 优先级2: 从当前目录向上查找 .mrd-to-code-org.json
  let dir = process.cwd();
  const root = path.parse(dir).root;
  while (dir !== root) {
    const orgPath = path.join(dir, '.mrd-to-code-org.json');
    if (fs.existsSync(orgPath)) return orgPath;
    dir = path.dirname(dir);
  }
  return null;
}

function findWorkspaceConfig() {
  // 从当前目录向上查找 .mrd-to-code-workspace.json
  let dir = process.cwd();
  const root = path.parse(dir).root;
  while (dir !== root) {
    const wsPath = path.join(dir, '.mrd-to-code-workspace.json');
    if (fs.existsSync(wsPath)) return wsPath;
    dir = path.dirname(dir);
  }
  return null;
}

function findProjectConfig() {
  const projectPath = path.join(process.cwd(), '.mrd-to-code-config.json');
  if (fs.existsSync(projectPath)) return projectPath;
  return null;
}

// ---- 配置加载 -------------------------------------------------------

function loadJson(filePath) {
  if (!filePath) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.warn(`[config-resolver] 警告: 无法加载 ${filePath}: ${e.message}`);
    return null;
  }
}

// ---- 配置合并 -------------------------------------------------------

/**
 * 深度合并两个对象，返回合并结果
 * @param {object} base - 底层配置（被覆盖）
 * @param {object} override - 上层配置（覆盖者）
 * @param {object} options
 * @param {Set<string>} options.lockedPaths - 被 locked 的字段路径集合
 * @param {object} options.sources - 记录每个字段的来源
 * @param {string} options.currentSource - 当前配置层名称
 * @param {string} options.baseSource - 底层配置层名称
 * @param {Array<string>} options.path - 当前递归路径
 */
function deepMerge(base, override, options, path = []) {
  const { lockedPaths, sources, currentSource, baseSource } = options;

  if (override === null || override === undefined) {
    return base;
  }
  if (base === null || base === undefined) {
    return override;
  }

  if (typeof base !== 'object' || typeof override !== 'object') {
    return override;
  }

  if (Array.isArray(base) !== Array.isArray(override)) {
    return override;
  }

  if (Array.isArray(base) && Array.isArray(override)) {
    // 数组直接覆盖，不合并
    return override;
  }

  const result = { ...base };

  for (const key of Object.keys(override)) {
    const currentPath = [...path, key];
    const pathStr = currentPath.join('.');
    const isLocked = lockedPaths.has(pathStr);

    if (isLocked) {
      // locked 字段不可被低层覆盖，保留 base 的值
      if (base.hasOwnProperty(key)) {
        sources[pathStr] = baseSource;
      }
      continue;
    }

    if (typeof base[key] === 'object' && typeof override[key] === 'object' &&
        base[key] !== null && override[key] !== null &&
        !Array.isArray(base[key]) && !Array.isArray(override[key])) {
      // 递归合并嵌套对象
      result[key] = deepMerge(base[key], override[key], options, currentPath);
    } else {
      // 直接覆盖
      result[key] = override[key];
      sources[pathStr] = currentSource;
    }
  }

  return result;
}

/**
 * 收集所有 locked 字段路径
 */
function collectLockedPaths(obj, prefix = '', lockedSet = new Set()) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return lockedSet;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && value !== null) {
      if (value.locked === true) {
        lockedSet.add(currentPath);
      } else {
        collectLockedPaths(value, currentPath, lockedSet);
      }
    }
  }
  return lockedSet;
}

/**
 * 为结果添加来源注释
 */
function annotateWithSources(obj, sources, pathPrefix = '', annotations = {}) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return annotations;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (sources[currentPath]) {
      annotations[currentPath] = { __source: sources[currentPath] };
    }
    if (value && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      annotateWithSources(value, sources, currentPath, annotations);
    }
  }
  return annotations;
}

// ---- 主流程 -------------------------------------------------------

function resolveConfig() {
  console.log('[config-resolver] 开始解析三层配置...\n');

  // 1. 加载各层配置
  const orgPath = findOrgConfig();
  const workspacePath = findWorkspaceConfig();
  const projectPath = findProjectConfig();

  const orgConfig = loadJson(orgPath);
  const workspaceConfig = loadJson(workspacePath);
  const projectConfig = loadJson(projectPath);

  console.log(`[config-resolver] org:       ${orgPath || '(未找到)'}`);
  console.log(`[config-resolver] workspace: ${workspacePath || '(未找到)'}`);
  console.log(`[config-resolver] project:   ${projectPath || '(未找到)'}`);
  console.log();

  // 2. 收集 locked 字段（从 org 开始，locked 不可被低层覆盖）
  const lockedPaths = new Set();
  if (orgConfig) {
    collectLockedPaths(orgConfig, '', lockedPaths);
    console.log(`[config-resolver] org 中 locked 字段: ${[...lockedPaths].join(', ') || '(无)'}`);
  }

  // 3. 按优先级合并：org -> workspace -> project
  const sources = {};
  const mergeOptions = { lockedPaths, sources };

  let merged = {};
  if (orgConfig) {
    merged = { ...orgConfig };
    for (const key of Object.keys(orgConfig)) {
      sources[key] = 'org';
    }
    console.log('[config-resolver] 已加载 org 配置');
  }

  if (workspaceConfig) {
    merged = deepMerge(merged, workspaceConfig, { ...mergeOptions, currentSource: 'workspace', baseSource: 'org' });
    console.log('[config-resolver] 已合并 workspace 配置');
  }

  if (projectConfig) {
    merged = deepMerge(merged, projectConfig, { ...mergeOptions, currentSource: 'project', baseSource: 'workspace' });
    console.log('[config-resolver] 已合并 project 配置');
  }

  // 4. 添加元数据
  merged.__meta = {
    resolved_at: new Date().toISOString(),
    layers: {
      org: orgPath ? path.resolve(orgPath) : null,
      workspace: workspacePath ? path.resolve(workspacePath) : null,
      project: projectPath ? path.resolve(projectPath) : null
    },
    source_tracking: sources
  };

  console.log('\n[config-resolver] 配置合并完成');

  return merged;
}

// ---- 输出 -------------------------------------------------------

function main() {
  const resolved = resolveConfig();

  if (ARG_DRY_RUN) {
    console.log('\n[config-resolver] === 合并后的配置（dry-run）===');
    console.log(JSON.stringify(resolved, null, 2));
    return;
  }

  // 输出到 .workflow/resolved-config.json 或指定路径
  const outputFile = OUTPUT_PATH || path.join('.workflow', 'resolved-config.json');

  // 确保 .workflow 目录存在
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, JSON.stringify(resolved, null, 2), 'utf-8');
  console.log(`\n[config-resolver] 已写入: ${path.resolve(outputFile)}`);
}

main();
