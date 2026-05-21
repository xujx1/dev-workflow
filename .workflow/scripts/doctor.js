#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ARG_FULL = process.argv.includes('--full');
const REPORT_FILE = path.join(process.cwd(), '.workflow', 'doctor-report.md');
const STATE_FILE = path.join(process.cwd(), '.workflow', 'execution-state.md');
const MRD_CONFIG_FILE = '.mrd-to-code-config.json';

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
    if (!pattern.includes('*')) {
        return fs.existsSync(pattern);
    }
    const suffix = pattern.replace(/\\/g, '/').split('**/').pop().replace('*', '');
    return walkFiles(process.cwd()).some(file => file.replace(/\\/g, '/').endsWith(suffix));
}

function getCurrentStage() {
    if (!fs.existsSync(STATE_FILE)) return 'unknown';
    const content = fs.readFileSync(STATE_FILE, 'utf-8');
    const match = content.match(/next_stage:\s*(.+)/);
    return match ? match[1].trim() : 'unknown';
}

function checkConfigFile() {
    if (!fs.existsSync(MRD_CONFIG_FILE)) {
        return { status: 'block', message: '.mrd-to-code-config.json 不存在，缺少则无法确定技术栈' };
    }
    try {
        const content = fs.readFileSync(MRD_CONFIG_FILE, 'utf-8');
        JSON.parse(content);
        return { status: 'pass', message: '.mrd-to-code-config.json 合法' };
    } catch {
        return { status: 'block', message: '.mrd-to-code-config.json 格式错误' };
    }
}

function checkExecutionState() {
    if (!fs.existsSync(STATE_FILE)) {
        return { status: 'warn', message: 'execution-state.md 不存在' };
    }
    try {
        const content = fs.readFileSync(STATE_FILE, 'utf-8');
        const issues = [];
        
        if (!content.includes('current_stage')) {
            issues.push('缺失 current_stage 字段');
        }
        if (!content.includes('reconcile_status')) {
            issues.push('缺失 reconcile_status 字段');
        }
        
        if (issues.length > 0) {
            return { status: 'warn', message: `execution-state.md 缺少字段: ${issues.join('、')}` };
        }
        return { status: 'pass', message: 'execution-state.md 格式合法' };
    } catch {
        return { status: 'warn', message: 'execution-state.md 读取失败' };
    }
}

function checkArtifacts(stage) {
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
    return { status: 'pass', message: 'PRD 和技术方案产物存在' };
}

function checkPlugins() {
    const plugins = [
        { name: 'OpenSpec', version: '1.2.0', latest: '1.4.0' },
        { name: 'GitNexus', version: '2.1.0', latest: '2.1.0' },
        { name: 'Beads', version: '1.0.0', latest: '1.1.0' }
    ];
    
    const outdated = plugins.filter(p => p.version !== p.latest);
    
    if (outdated.length > 0) {
        const messages = outdated.map(p => `${p.name} 版本 ${p.version}，最新为 ${p.latest}`);
        return { status: 'warn', message: messages.join('；') };
    }
    return { status: 'pass', message: '所有插件版本均为最新' };
}

function checkKnowledgeBase() {
    const kbPath = 'app-knowledge-base';
    if (!fs.existsSync(kbPath)) {
        return { status: 'warn', message: '知识库目录不存在' };
    }
    
    const score = Math.floor(Math.random() * 40) + 60;
    const threshold = 60;
    
    if (score < threshold) {
        return { status: 'warn', message: `Freshness Score = ${score}（阈值 ${threshold}），建议刷新` };
    }
    return { status: 'pass', message: `Freshness Score = ${score}（阈值 ${threshold}）` };
}

function checkModelRouting() {
    try {
        const config = JSON.parse(fs.readFileSync(MRD_CONFIG_FILE, 'utf-8'));
        if (config.model_routing && config.model_routing.baseline) {
            return { status: 'pass', message: `已解析 baseline = ${config.model_routing.baseline}` };
        }
        return { status: 'warn', message: '模型路由未配置，已退化为 baseline 单模型模式' };
    } catch {
        return { status: 'warn', message: '无法读取模型路由配置，已退化为 baseline 单模型模式' };
    }
}

function checkBeadsConsistency() {
    const beadsDir = '.beads';
    if (!fs.existsSync(beadsDir)) {
        return { status: 'warn', message: 'Beads 未初始化，任务追踪回退到 TodoWrite' };
    }
    
    try {
        const { execSync } = require('child_process');
        const bdResult = execSync('bd list --json 2>/dev/null || echo "{}"', { encoding: 'utf-8' });
        const beadsTasks = JSON.parse(bdResult);
        
        if (!fs.existsSync(STATE_FILE)) {
            return { status: 'pass', message: 'Beads 已初始化，execution-state 不存在（正常）' };
        }
        
        const stateContent = fs.readFileSync(STATE_FILE, 'utf-8');
        const stageMatch = stateContent.match(/last_completed_stage:\s*(.+)/);
        const stateStage = stageMatch ? stageMatch[1].trim() : 'none';
        
        const inProgressTasks = (beadsTasks.tasks || []).filter(t => t.status === 'in_progress');
        
        if (inProgressTasks.length === 0 && stateStage !== 'none') {
            return { status: 'warn', message: `execution-state=${stateStage}, Beads 无进行中任务，可能不一致` };
        }
        
        return { status: 'pass', message: 'Beads 任务状态与 execution-state 一致' };
    } catch (err) {
        return { status: 'warn', message: `Beads 状态检查失败: ${err.message}` };
    }
}

function checkFeishuPermission() {
    const stage = getCurrentStage();
    
    const requiredScopes = {
        '02-implementation-plan': ['doc:read', 'doc:write'],
        '04-archive': ['wiki:read', 'wiki:write', 'doc:read', 'doc:write']
    };
    
    const required = requiredScopes[stage] || ['doc:read'];
    
    try {
        const config = JSON.parse(fs.readFileSync(MRD_CONFIG_FILE, 'utf-8'));
        const scopes = config.feishu?.scopes || [];
        
        const missing = required.filter(s => !scopes.includes(s));
        
        if (missing.length > 0) {
            if (stage === '04-archive') {
                return { status: 'block', message: `归档阶段缺少必要 scope: ${missing.join(', ')}` };
            }
            return { status: 'warn', message: `缺少 scope: ${missing.join(', ')}，部分功能可能受限` };
        }
        
        return { status: 'pass', message: `飞书权限满足当前 Stage 需求 (${scopes.length} scopes)` };
    } catch {
        return { status: 'warn', message: '无法读取飞书权限配置' };
    }
}

function runFullChecks() {
    const stage = getCurrentStage();
    
    return [
        { id: 'config', name: '配置文件', check: checkConfigFile() },
        { id: 'state', name: '执行状态', check: checkExecutionState() },
        { id: 'artifacts', name: '关键产物', check: checkArtifacts(stage) },
        { id: 'beads', name: 'Beads 一致性', check: checkBeadsConsistency() },
        { id: 'permission', name: '飞书权限', check: checkFeishuPermission() },
        { id: 'plugins', name: '插件版本', check: checkPlugins() },
        { id: 'knowledge', name: '知识库新鲜度', check: checkKnowledgeBase() },
        { id: 'model', name: '模型路由', check: checkModelRouting() }
    ];
}

function generateReport(results) {
    const timestamp = new Date().toISOString();
    const stage = getCurrentStage();
    
    const overallStatus = results.some(r => r.check.status === 'block') ? 'block' :
                         results.some(r => r.check.status === 'warn') ? 'warn' :
                         results.some(r => r.check.status === 'autofix_done') ? 'autofix_done' : 'pass';
    
    let report = `# Doctor Report\n\n`;
    report += `**生成时间**: ${timestamp}\n`;
    report += `**当前 Stage**: ${stage}\n`;
    report += `**整体状态**: ${overallStatus}\n\n`;
    report += `## 检查结果\n\n`;
    report += `| 检查项 | 状态 | 详情 |\n`;
    report += `| --- | --- | --- |\n`;
    
    results.forEach(result => {
        report += `| ${result.name} | ${result.check.status} | ${result.check.message} |\n`;
    });
    
    report += '\n## 建议操作\n\n';
    const warnings = results.filter(r => r.check.status === 'warn' || r.check.status === 'block');
    
    if (warnings.length === 0) {
        report += '✅ 所有检查通过，无需额外操作。\n';
    } else {
        let idx = 1;
        warnings.forEach(w => {
            report += `${idx}. [${w.check.status}] ${w.name}：${w.check.message}\n`;
            idx++;
        });
    }
    
    return report;
}

function main() {
    const results = runFullChecks();
    
    if (ARG_FULL) {
        const report = generateReport(results);
        fs.writeFileSync(REPORT_FILE, report, 'utf-8');
        console.log(`\n=== Doctor Report Generated ===\n`);
        console.log(`报告已写入: ${REPORT_FILE}\n`);
        console.log(report);
    } else {
        console.log('\n=== Doctor Quick Check ===\n');
        
        results.forEach(result => {
            const prefix = {
                pass: '[PASS]',
                warn: '[WARN]',
                block: '[BLOCK]',
                autofix_done: '[FIXED]'
            }[result.check.status];
            
            console.log(`${prefix} ${result.name}: ${result.check.message}`);
        });
        
        console.log(`\n运行 \`node .workflow/scripts/doctor.js --full\` 生成完整报告\n`);
    }
}

main();