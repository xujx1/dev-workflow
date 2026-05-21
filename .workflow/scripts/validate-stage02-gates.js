#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { validatePrdFile } = require('./validate-prd');
const { validateTechDesignFile } = require('./validate-tech-design');

function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--json') {
            args.json = true;
        } else if (arg.startsWith('--')) {
            args[arg.slice(2)] = argv[i + 1];
            i++;
        }
    }
    return args;
}

function mergeResult(target, id, result) {
    target.checks.push({ id, status: result.status, checks: result.checks || [] });
    for (const error of result.errors || []) {
        target.errors.push(`[${id}] ${error}`);
    }
    for (const warning of result.warnings || []) {
        target.warnings.push(`[${id}] ${warning}`);
    }
}

function hasStateRecord(content, patterns) {
    return patterns.some(pattern => pattern.test(content));
}

function validateExecutionState(statePath) {
    if (!fs.existsSync(statePath)) {
        return {
            status: 'block',
            errors: [`执行状态文件不存在: ${statePath}`],
            warnings: [],
            checks: [],
        };
    }

    const content = fs.readFileSync(statePath, 'utf-8');
    const errors = [];
    const warnings = [];
    const checks = [];

    const hasComplexity = /complexity:\s*\n|##\s*复杂度分级/.test(content);
    checks.push({ id: 'complexity_recorded', passed: hasComplexity });
    if (!hasComplexity) {
        errors.push('execution-state.md 缺少复杂度分级记录');
    }

    const hasModelRouting = hasStateRecord(content, [
        /model_routing:/,
        /model_selection:/,
        /model_used:/,
        /模型路由/,
    ]);
    checks.push({ id: 'model_routing_recorded', passed: hasModelRouting });
    if (!hasModelRouting) {
        errors.push('execution-state.md 缺少模型路由调用或 fallback 记录');
    }

    const hasPrdFeishu = /prd_feishu_url\s*\|?\s*https?:\/\/|prd_feishu_url:\s*https?:\/\//.test(content);
    const hasTechFeishu = /tech_feishu_url\s*\|?\s*https?:\/\/|tech_feishu_url:\s*https?:\/\//.test(content);
    const hasReadback = /feishu_readback:\s*(pass|true)|回读校验[:：]\s*(pass|true|通过)|回读验证[:：]\s*(pass|true|通过)/.test(content);
    checks.push({ id: 'feishu_prd_url_recorded', passed: hasPrdFeishu });
    checks.push({ id: 'feishu_tech_url_recorded', passed: hasTechFeishu });
    checks.push({ id: 'feishu_readback_recorded', passed: hasReadback });
    if (!hasPrdFeishu || !hasTechFeishu || !hasReadback) {
        errors.push('execution-state.md 缺少飞书上传地址或回读校验记录');
    }

    const beadsUnavailable = /beads[\s\S]{0,160}(failed|unavailable|不可用|失败|权限)/i.test(content);
    const beadsFallback = /beads[\s\S]{0,240}(fallback|回退|execution-state\.md|派发清单)/i.test(content);
    checks.push({ id: 'beads_fallback_recorded', passed: !beadsUnavailable || beadsFallback });
    if (beadsUnavailable && !beadsFallback) {
        errors.push('Beads 不可用时必须记录 execution-state fallback');
    }

    const gitnexusUnavailable = /gitnexus[\s\S]{0,180}(failed|unavailable|not found|不可用|失败|未找到)/i.test(content);
    const gitnexusFallback = /gitnexus[\s\S]{0,260}(fallback|回退|代码分析|manual|人工分析|索引)/i.test(content);
    checks.push({ id: 'gitnexus_fallback_recorded', passed: !gitnexusUnavailable || gitnexusFallback });
    if (gitnexusUnavailable && !gitnexusFallback) {
        errors.push('GitNexus 不可用或索引缺失时必须记录 fallback 分析');
    }

    return {
        status: errors.length > 0 ? 'block' : warnings.length > 0 ? 'warn' : 'pass',
        errors,
        warnings,
        checks,
        content,
    };
}

function isOpenSpecTriggered(stateContent) {
    return /openspec:\s*\n[\s\S]{0,240}triggered:\s*true/.test(stateContent)
        || /openspec:\s*(true|required|force)/i.test(stateContent)
        || /recommended_flow:\s*\n[\s\S]{0,240}openspec:\s*true/.test(stateContent);
}

function findOpenSpecChangeDir(featureDir) {
    const featureName = path.basename(path.resolve(featureDir));
    const candidates = [
        path.join(featureDir, 'openspec', 'changes', featureName),
        path.join(featureDir, '..', '..', 'openspec', 'changes', featureName),
        path.join(process.cwd(), 'openspec', 'changes', featureName),
    ].map(candidate => path.resolve(candidate));

    return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
}

function validateOpenSpec(featureDir, stateContent) {
    const checks = [];
    const errors = [];
    const warnings = [];

    const triggered = isOpenSpecTriggered(stateContent);
    checks.push({ id: 'openspec_triggered', passed: triggered });
    if (!triggered) {
        return { status: 'pass', errors, warnings, checks };
    }

    const changeDir = findOpenSpecChangeDir(featureDir);
    const required = ['proposal.md', 'design.md', 'tasks.md', 'test_spec.md'];
    const missing = required.filter(file => !fs.existsSync(path.join(changeDir, file)));
    checks.push({ id: 'openspec_artifacts_present', passed: missing.length === 0, path: changeDir });
    if (missing.length > 0) {
        errors.push(`OpenSpec 已触发但缺少 artifacts: ${missing.join(', ')}`);
    }

    return {
        status: errors.length > 0 ? 'block' : warnings.length > 0 ? 'warn' : 'pass',
        errors,
        warnings,
        checks,
    };
}

function validateStage02(featureDir) {
    const result = { status: 'pass', errors: [], warnings: [], checks: [] };

    if (!featureDir) {
        result.status = 'block';
        result.errors.push('缺少 --feature-dir 参数');
        return result;
    }

    const prdPath = path.join(featureDir, 'prd.md');
    const techPath = path.join(featureDir, 'tech-design.md');
    const statePath = path.join(featureDir, 'execution-state.md');

    mergeResult(result, 'prd', validatePrdFile(prdPath));
    mergeResult(result, 'tech-design', validateTechDesignFile(techPath));

    const stateResult = validateExecutionState(statePath);
    mergeResult(result, 'execution-state', stateResult);

    const openspecResult = validateOpenSpec(featureDir, stateResult.content || '');
    mergeResult(result, 'openspec', openspecResult);

    result.status = result.errors.length > 0 ? 'block' : result.warnings.length > 0 ? 'warn' : 'pass';
    return result;
}

function main() {
    const args = parseArgs(process.argv);
    const result = validateStage02(args['feature-dir']);

    if (args.json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log(`Stage 02 gate validation: ${result.status}`);
        for (const error of result.errors) {
            console.log(`[BLOCK] ${error}`);
        }
        for (const warning of result.warnings) {
            console.log(`[WARN] ${warning}`);
        }
    }

    process.exit(result.status === 'block' ? 1 : 0);
}

if (require.main === module) {
    main();
}

module.exports = {
    validateStage02,
    validateExecutionState,
    validateOpenSpec,
};
