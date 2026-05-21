#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { validateStage02 } = require('./validate-stage02-gates');

const STATE_FILE = path.join(process.cwd(), '.workflow', 'execution-state.md');
const CONFIG_FILE = path.join(process.cwd(), '.workflow', 'config.json');
const MRD_CONFIG_FILE = '.mrd-to-code-config.json';

const ARG_STAGE = process.argv.includes('--stage') 
    ? process.argv[process.argv.indexOf('--stage') + 1] 
    : null;
const ARG_FEATURE_DIR = process.argv.includes('--feature-dir')
    ? process.argv[process.argv.indexOf('--feature-dir') + 1]
    : null;
const ARG_OUTPUT = process.argv.includes('--json') ? 'json' : 'text';

function hasGlobMagic(pattern) {
    return pattern.includes('*');
}

function walkFiles(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return walkFiles(fullPath);
        }
        return [fullPath];
    });
}

function patternExists(pattern) {
    if (!hasGlobMagic(pattern)) {
        return fs.existsSync(pattern);
    }

    const normalized = pattern.replace(/\\/g, '/');
    const suffix = normalized.split('**/').pop().replace('*', '');
    return walkFiles(process.cwd()).some(file => file.replace(/\\/g, '/').endsWith(suffix));
}

const CHECKS = {
    config: {
        name: '配置文件',
        category: 'config',
        check: () => {
            if (!fs.existsSync(MRD_CONFIG_FILE)) {
                return { status: 'block', message: '.mrd-to-code-config.json 不存在' };
            }
            try {
                const content = fs.readFileSync(MRD_CONFIG_FILE, 'utf-8');
                JSON.parse(content);
                return { status: 'pass', message: '.mrd-to-code-config.json 合法' };
            } catch {
                return { status: 'block', message: '.mrd-to-code-config.json 格式错误' };
            }
        }
    },
    state: {
        name: '执行状态',
        category: 'state',
        check: () => {
            if (!fs.existsSync(STATE_FILE)) {
                return { status: 'warn', message: 'execution-state.md 不存在' };
            }
            try {
                const content = fs.readFileSync(STATE_FILE, 'utf-8');
                const missing = [];
                if (!content.includes('current_stage')) {
                    missing.push('current_stage: unknown');
                }
                if (!content.includes('reconcile_status')) {
                    missing.push('reconcile_status: unknown');
                }
                if (missing.length > 0) {
                    return { status: 'warn', message: `execution-state.md 缺少字段: ${missing.map(item => item.split(':')[0]).join(', ')}` };
                }
                return { status: 'pass', message: 'execution-state.md 格式合法' };
            } catch {
                return { status: 'warn', message: 'execution-state.md 读取失败' };
            }
        }
    },
    artifacts: {
        name: '关键产物',
        category: 'artifact',
        check: (stage) => {
            const requiredArtifacts = {
                '00-init': ['.workflow/'],
                '01-knowledge-base': ['app-knowledge-base/'],
                '02-implementation-plan': ['req/', '.workflow/execution-state.md'],
                '03-code-gen-tdd': ['req/**/tech-design.md', '.workflow/execution-state.md'],
                '04-archive': ['req/**/tech-design.md', '.workflow/execution-state.md']
            };
            
            const artifacts = requiredArtifacts[stage] || [];
            const missing = [];
            
            artifacts.forEach(artifact => {
                if (!patternExists(artifact)) {
                    missing.push(artifact);
                }
            });
            
            if (missing.length > 0) {
                return { 
                    status: stage === '00-init' ? 'warn' : 'block', 
                    message: `缺失关键产物: ${missing.join(', ')}` 
                };
            }
            return { status: 'pass', message: '所有关键产物存在' };
        }
    },
    directory: {
        name: '目录结构',
        category: 'config',
        check: () => {
            const requiredDirs = ['.workflow/', 'req/'];
            let autofixed = [];
            
            requiredDirs.forEach(dir => {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                    autofixed.push(dir);
                }
            });
            
            if (autofixed.length > 0) {
                return { status: 'autofix_done', message: `已自动修复：创建缺失目录 ${autofixed.join(', ')}` };
            }
            return { status: 'pass', message: '必要目录存在' };
        }
    },
    stage02Gate: {
        name: 'Stage 02 确认门',
        category: 'artifact',
        check: (stage) => {
            if (!['02-implementation-plan', 'stage02', 'stage2'].includes(stage)) {
                return { status: 'pass', message: '非 Stage 02，跳过确认门校验' };
            }
            if (!ARG_FEATURE_DIR) {
                return { status: 'warn', message: '未提供 --feature-dir，跳过 Stage 02 确认门校验' };
            }

            const result = validateStage02(ARG_FEATURE_DIR);
            if (result.status === 'block') {
                return { status: 'block', message: result.errors.join('；') };
            }
            if (result.status === 'warn') {
                return { status: 'warn', message: result.warnings.join('；') };
            }
            return { status: 'pass', message: 'Stage 02 确认门校验通过' };
        }
    }
};

function runChecks(stage) {
    const results = [];
    let overallStatus = 'pass';
    
    Object.entries(CHECKS).forEach(([key, check]) => {
        try {
            const result = check.check(stage);
            results.push({
                id: key,
                name: check.name,
                category: check.category,
                status: result.status,
                message: result.message
            });
            
            if (result.status === 'block') {
                overallStatus = 'block';
            } else if (result.status === 'warn' && overallStatus === 'pass') {
                overallStatus = 'warn';
            } else if (result.status === 'autofix_done' && overallStatus === 'pass') {
                overallStatus = 'autofix_done';
            }
        } catch (err) {
            results.push({
                id: key,
                name: check.name,
                category: check.category,
                status: 'warn',
                message: `检查失败: ${err.message}`
            });
            if (overallStatus === 'pass') {
                overallStatus = 'warn';
            }
        }
    });
    
    return { overallStatus, results };
}

function outputText(result) {
    console.log('\n=== Doctor Pre-Stage Check ===\n');
    
    result.results.forEach(check => {
        const prefix = {
            pass: '[PASS]',
            warn: '[WARN]',
            block: '[BLOCK]',
            autofix_done: '[FIXED]'
        }[check.status];
        
        console.log(`${prefix} ${check.name}: ${check.message}`);
    });
    
    console.log(`\n=== Overall: ${result.overallStatus.toUpperCase()} ===\n`);
}

function outputJson(result) {
    console.log(JSON.stringify(result, null, 2));
}

function main() {
    const stage = ARG_STAGE || 'unknown';
    const result = runChecks(stage);
    
    if (ARG_OUTPUT === 'json') {
        outputJson(result);
    } else {
        outputText(result);
    }
    
    process.exit(result.overallStatus === 'block' ? 1 : 0);
}

main();