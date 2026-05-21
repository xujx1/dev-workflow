#!/usr/bin/env node
const fs = require('fs');

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

function hasHeadingsInOrder(content, headings) {
    let cursor = -1;
    const missing = [];
    for (const heading of headings) {
        const index = content.indexOf(heading);
        if (index === -1) {
            missing.push(heading);
            continue;
        }
        if (index < cursor) {
            return { passed: false, missing, ordered: false };
        }
        cursor = index;
    }
    return { passed: missing.length === 0, missing, ordered: true };
}

function collectCodeFences(content) {
    const fences = [];
    const fenceRegex = /```([^\n`]*)\n[\s\S]*?```/g;
    let match;
    while ((match = fenceRegex.exec(content)) !== null) {
        fences.push({
            lang: match[1].trim().toLowerCase(),
            body: match[0],
        });
    }
    return fences;
}

function validateTechDesignContent(content) {
    const errors = [];
    const warnings = [];
    const checks = [];

    const compactTemplate = [
        '## 一、需求概述',
        '## 二、接口变更',
        '## 三、核心',
        '## 四、时序图',
        '## 五、影响',
        '## 六、工时',
        '## 七、测试',
        '## 八、风险',
        '## 九、备注',
    ];

    const fullTemplate = [
        '### 一、时间轴',
        '### 二、项目概述',
        '### 三、详细设计',
        '### 四、稳定性设计',
        '### 五、测试策略',
        '### 六、上线方案',
        '### 七、附录',
    ];

    const compactResult = hasHeadingsInOrder(content, compactTemplate);
    const fullResult = hasHeadingsInOrder(content, fullTemplate);
    const templateMatched = compactResult.passed || fullResult.passed;
    checks.push({ id: 'template_structure', passed: templateMatched });
    if (!templateMatched) {
        errors.push(`技术方案章节不符合模板，缺少: ${compactResult.missing.concat(fullResult.missing).join(', ')}`);
    }

    if (compactResult.passed) {
        const appendices = ['## 附录I', '## 附录II', '## 附录III', '## 附录IV'];
        const appendixResult = hasHeadingsInOrder(content, appendices);
        checks.push({ id: 'compact_appendices_i_to_iv', passed: appendixResult.passed });
        if (!appendixResult.passed) {
            errors.push(`技术方案紧凑模板必须包含附录I~IV，缺少: ${appendixResult.missing.join(', ')}`);
        }
    }

    const fences = collectCodeFences(content);
    const diagramLikeFence = fences.find(fence =>
        fence.lang !== 'mermaid'
        && /(flowchart|sequenceDiagram|stateDiagram|-->|->|\+\-{3,}|\|.*\|)/.test(fence.body)
    );
    checks.push({ id: 'diagrams_are_mermaid', passed: !diagramLikeFence });
    if (diagramLikeFence) {
        errors.push('技术方案中的图表必须使用 Mermaid，不能使用 ASCII art 或无语言代码块表达流程');
    }

    const hasMermaid = fences.some(fence => fence.lang === 'mermaid');
    checks.push({ id: 'has_mermaid_diagram', passed: hasMermaid });
    if (!hasMermaid) {
        warnings.push('技术方案未检测到 Mermaid 图表');
    }

    const asciiArtPatterns = [
        /[┌┐└┘├┤┬┴┼│─]/,
        /(^|\n)\s*\+[-=]{3,}\+/,
    ];
    const hasAsciiArt = asciiArtPatterns.some(pattern => pattern.test(content));
    checks.push({ id: 'no_ascii_art', passed: !hasAsciiArt });
    if (hasAsciiArt) {
        errors.push('技术方案不允许包含 ASCII art 或文本框图');
    }

    const requiredTopics = [
        { id: 'impact_analysis', pattern: /影响范围|影响分析|稳定性分析/ },
        { id: 'test_strategy', pattern: /测试要点|测试策略|单元测试/ },
        { id: 'risk_assessment', pattern: /风险评估|风险分析|稳定性设计/ },
        { id: 'effort_estimate', pattern: /工时预估|需求复杂度估算|预估工时/ },
    ];

    for (const topic of requiredTopics) {
        const passed = topic.pattern.test(content);
        checks.push({ id: topic.id, passed });
        if (!passed) {
            errors.push(`技术方案缺少必要主题: ${topic.id}`);
        }
    }

    return {
        status: errors.length > 0 ? 'block' : warnings.length > 0 ? 'warn' : 'pass',
        errors,
        warnings,
        checks,
    };
}

function validateTechDesignFile(filePath) {
    if (!filePath) {
        return {
            status: 'block',
            errors: ['缺少 --file 参数'],
            warnings: [],
            checks: [],
        };
    }

    if (!fs.existsSync(filePath)) {
        return {
            status: 'block',
            errors: [`技术方案文件不存在: ${filePath}`],
            warnings: [],
            checks: [],
        };
    }

    return validateTechDesignContent(fs.readFileSync(filePath, 'utf-8'));
}

function main() {
    const args = parseArgs(process.argv);
    const result = validateTechDesignFile(args.file);

    if (args.json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log(`Tech design validation: ${result.status}`);
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
    validateTechDesignContent,
    validateTechDesignFile,
};
