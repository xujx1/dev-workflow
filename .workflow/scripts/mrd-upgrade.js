#!/usr/bin/env node
/**
 * mrd-upgrade.js — 按层级升级 dev-workflow 配置
 *
 * 用法：
 *   mrd-upgrade --layer org [--version <ver>]        # 升级组织级配置
 *   mrd-upgrade --layer workspace [--version <ver>]  # 升级项目集级配置
 *   mrd-upgrade --layer project [--interactive]      # 升级项目级配置（需确认）
 *   mrd-upgrade --all                                # 升级所有层级
 *
 * 配置路径约定：
 *   org:       ~/.config/mrd-to-code/org-config.json
 *   workspace: {monorepo-root}/.mrd-to-code-workspace.json
 *   project:   {project-dir}/.mrd-to-code-config.json
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const ARGS = process.argv.slice(2);
const ARG_LAYER_IDX = ARGS.indexOf('--layer');
const ARG_VERSION_IDX = ARGS.indexOf('--version');
const ARG_INTERACTIVE = ARGS.includes('--interactive');
const ARG_ALL = ARGS.includes('--all');
const ARG_DRY_RUN = ARGS.includes('--dry-run');

const LAYER = ARG_LAYER_IDX !== -1 ? ARGS[ARG_LAYER_IDX + 1] : null;
const VERSION = ARG_VERSION_IDX !== -1 ? ARGS[ARG_VERSION_IDX + 1] : null;

const VALID_LAYERS = ['org', 'workspace', 'project'];

function expandHome(filePath) {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function findOrgConfig() {
  const localPath = expandHome('~/.config/mrd-to-code/org-config.json');
  if (fs.existsSync(localPath)) return localPath;

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

function loadJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error(`[mrd-upgrade] 错误: 无法加载 ${filePath}: ${e.message}`);
    return null;
  }
}

function saveJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getDefaultOrgConfig() {
  return {
    version: VERSION || '1.0',
    layer: 'org',
    code_style: {
      max_line_length: 120,
      indent: '4-spaces'
    },
    security: {
      forbidden_models: ['gpt-3.5-turbo'],
      locked: true
    },
    knowledge_base: {
      default_freshness_threshold: 5
    }
  };
}

function getDefaultWorkspaceConfig() {
  return {
    version: VERSION || '1.0',
    layer: 'workspace',
    shared_knowledge_base: 'shared-knowledge-base/',
    common_dependencies: {}
  };
}

function getDefaultProjectConfig() {
  return {
    version: VERSION || '1.0',
    layer: 'project',
    project: {
      name: path.basename(process.cwd())
    },
    openspec: {
      enabled: true,
      threshold_person_days: 5
    }
  };
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function upgradeOrg() {
  console.log('\n[mrd-upgrade] === 升级 org 层配置 ===\n');

  const orgPath = findOrgConfig() || expandHome('~/.config/mrd-to-code/org-config.json');
  const existing = loadJson(orgPath);

  if (existing) {
    console.log(`[mrd-upgrade] 发现现有配置: ${orgPath}`);
    console.log(`[mrd-upgrade] 当前版本: ${existing.version || '未知'}`);

    if (ARG_DRY_RUN) {
      console.log('[mrd-upgrade] (dry-run) 将更新版本为:', VERSION || existing.version);
      return;
    }

    const newConfig = { ...existing };
    if (VERSION) newConfig.version = VERSION;
    newConfig.last_upgraded = new Date().toISOString();

    saveJson(orgPath, newConfig);
    console.log(`[mrd-upgrade] 已更新: ${orgPath}`);
  } else {
    console.log(`[mrd-upgrade] 未找到 org 配置，将创建新配置: ${orgPath}`);

    if (ARG_DRY_RUN) {
      console.log('[mrd-upgrade] (dry-run) 将创建默认配置');
      return;
    }

    const newConfig = getDefaultOrgConfig();
    newConfig.created_at = new Date().toISOString();
    newConfig.last_upgraded = newConfig.created_at;

    saveJson(orgPath, newConfig);
    console.log(`[mrd-upgrade] 已创建: ${orgPath}`);
  }
}

async function upgradeWorkspace() {
  console.log('\n[mrd-upgrade] === 升级 workspace 层配置 ===\n');

  const wsPath = findWorkspaceConfig() || path.join(process.cwd(), '.mrd-to-code-workspace.json');
  const existing = loadJson(wsPath);

  if (existing) {
    console.log(`[mrd-upgrade] 发现现有配置: ${wsPath}`);
    console.log(`[mrd-upgrade] 当前版本: ${existing.version || '未知'}`);

    if (ARG_DRY_RUN) {
      console.log('[mrd-upgrade] (dry-run) 将更新版本为:', VERSION || existing.version);
      return;
    }

    const newConfig = { ...existing };
    if (VERSION) newConfig.version = VERSION;
    newConfig.last_upgraded = new Date().toISOString();

    saveJson(wsPath, newConfig);
    console.log(`[mrd-upgrade] 已更新: ${wsPath}`);
  } else {
    console.log(`[mrd-upgrade] 未找到 workspace 配置，将创建新配置: ${wsPath}`);

    if (ARG_DRY_RUN) {
      console.log('[mrd-upgrade] (dry-run) 将创建默认配置');
      return;
    }

    const newConfig = getDefaultWorkspaceConfig();
    newConfig.created_at = new Date().toISOString();
    newConfig.last_upgraded = newConfig.created_at;

    saveJson(wsPath, newConfig);
    console.log(`[mrd-upgrade] 已创建: ${wsPath}`);
  }
}

async function upgradeProject() {
  console.log('\n[mrd-upgrade] === 升级 project 层配置 ===\n');

  const projectPath = findProjectConfig();
  if (!projectPath) {
    console.log('[mrd-upgrade] 未找到 project 配置: .mrd-to-code-config.json');
    console.log('[mrd-upgrade] 请先运行 project-init 初始化');
    return;
  }

  const existing = loadJson(projectPath);
  console.log(`[mrd-upgrade] 发现现有配置: ${projectPath}`);
  console.log(`[mrd-upgrade] 当前版本: ${existing?.version || '未知'}`);

  if (ARG_INTERACTIVE) {
    console.log('\n[mrd-upgrade] 警告: 升级 project 配置可能覆盖自定义设置！');
    const answer = await promptUser('确认继续？(y/n): ');
    if (answer !== 'y' && answer !== 'yes') {
      console.log('[mrd-upgrade] 已取消');
      return;
    }
  }

  if (ARG_DRY_RUN) {
    console.log('[mrd-upgrade] (dry-run) 将更新版本为:', VERSION || existing?.version);
    return;
  }

  const newConfig = { ...existing };
  if (!newConfig.layer) newConfig.layer = 'project';
  if (VERSION) newConfig.version = VERSION;
  newConfig.last_upgraded = new Date().toISOString();

  saveJson(projectPath, newConfig);
  console.log(`[mrd-upgrade] 已更新: ${projectPath}`);
}

function printUsage() {
  console.log(`
用法:
  mrd-upgrade --layer org [--version <ver>]        升级组织级配置
  mrd-upgrade --layer workspace [--version <ver>]  升级项目集级配置
  mrd-upgrade --layer project [--interactive]      升级项目级配置（需确认）
  mrd-upgrade --all                                升级所有层级

选项:
  --layer <name>   指定升级层级 (org|workspace|project)
  --version <ver>  指定目标版本
  --interactive    交互模式，升级前需确认
  --all            升级所有层级
  --dry-run        预览模式，不实际写入

示例:
  mrd-upgrade --layer org --version 2.0
  mrd-upgrade --layer project --interactive
`);
}

async function main() {
  if (ARGS.length === 0 || ARGS.includes('--help') || ARGS.includes('-h')) {
    printUsage();
    return;
  }

  if (ARG_ALL) {
    await upgradeOrg();
    await upgradeWorkspace();
    await upgradeProject();
    console.log('\n[mrd-upgrade] 所有层级升级完成');
    return;
  }

  if (!LAYER || !VALID_LAYERS.includes(LAYER)) {
    console.error(`[mrd-upgrade] 错误: 无效的层级 "${LAYER}"`);
    console.error(`[mrd-upgrade] 有效层级: ${VALID_LAYERS.join(', ')}`);
    process.exit(1);
  }

  switch (LAYER) {
    case 'org':
      await upgradeOrg();
      break;
    case 'workspace':
      await upgradeWorkspace();
      break;
    case 'project':
      await upgradeProject();
      break;
  }

  console.log('\n[mrd-upgrade] 完成');
}

main().catch((e) => {
  console.error('[mrd-upgrade] 错误:', e.message);
  process.exit(1);
});
