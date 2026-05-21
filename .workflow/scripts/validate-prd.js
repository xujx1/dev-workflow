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

function validatePrdContent(content) {
    const errors = [];
    const warnings = [];
    const checks = [];

    const requiredHeadings = [
        '## 一、背景',
        '## 二、目标',
        '## 三、角色 / 场景',
        '## 四、功能变更',
        '## 五、业务规则',
        '## 六、验收标准',
        '## 七、边界 / 待确认',
    ];

    const headingPositions = [];
    for (const heading of requiredHeadings) {
        const index = content.indexOf(heading);
        checks.push({ id: `heading:${heading}`, passed: index !== -1 });
        if (index === -1) {
            errors.push(`缺少 PRD 模板章节: ${heading}`);
        }
        headingPositions.push(index);
    }

    const existingPositions = headingPositions.filter(index => index !== -1);
    const ordered = existingPositions.every((index, i) => i === 0 || index > existingPositions[i - 1]);
    checks.push({ id: 'headings_ordered', passed: ordered });
    if (!ordered) {
        errors.push('PRD 一~七章节顺序不符合模板');
    }

    const hasAppendix = /(^|\n)#{1,6}\s*附录|附录[一二三四五六七八九十ⅠⅡⅢⅣIVX]/.test(content);
    checks.push({ id: 'no_appendix', passed: !hasAppendix });
    if (hasAppendix) {
        errors.push('PRD 不允许包含附录');
    }

    const hasQuestionMarkTag = content.includes('❓');
    checks.push({ id: 'no_question_mark_tag', passed: !hasQuestionMarkTag });
    if (hasQuestionMarkTag) {
        errors.push('PRD 不允许保留 ❓ 待确认标注');
    }

    const fences = collectCodeFences(content);
    const contentWithoutFences = content.replace(/```([^\n`]*)\n[\s\S]*?```/g, '');
    const nonMermaidFences = fences.filter(fence => fence.lang !== 'mermaid');
    checks.push({ id: 'code_fences_mermaid_only', passed: nonMermaidFences.length === 0 });
    if (nonMermaidFences.length > 0) {
        errors.push('PRD 代码块仅允许 Mermaid 图表');
    }

    const hasMermaidFlowchart = fences.some(fence => fence.lang === 'mermaid' && /(^|\n)\s*flowchart\s+/i.test(fence.body));
    checks.push({ id: 'has_mermaid_flowchart', passed: hasMermaidFlowchart });
    if (!hasMermaidFlowchart) {
        errors.push('PRD 必须使用 Mermaid flowchart 表达业务流程');
    }

    const asciiArtPatterns = [
        /[┌┐└┘├┤┬┴┼│─]/,
        /(^|\n)\s*\+[-=]{3,}\+/,
    ];
    const hasAsciiArt = asciiArtPatterns.some(pattern => pattern.test(contentWithoutFences))
        || nonMermaidFences.some(fence => asciiArtPatterns.some(pattern => pattern.test(fence.body)));
    checks.push({ id: 'no_ascii_art', passed: !hasAsciiArt });
    if (hasAsciiArt) {
        errors.push('PRD 不允许包含 ASCII art 或文本框图');
    }

    const technicalSymbolPatterns = [
        /ServiceImpl\b/,
        /\bcom\.[a-zA-Z0-9_.]+/,
        /\b[A-Za-z0-9_]+#[A-Za-z0-9_]+\b/,
    ];
    const hasTechnicalSymbols = technicalSymbolPatterns.some(pattern => pattern.test(contentWithoutFences));
    checks.push({ id: 'no_technical_symbols', passed: !hasTechnicalSymbols });
    if (hasTechnicalSymbols) {
        errors.push('PRD 不允许出现实现类、包名、class#method 或代码调用符号');
    }

    const hasMetadata = />\s*\*\*生成元数据\*\*/.test(content)
        && />\s*工具：/.test(content)
        && />\s*生成时间：/.test(content)
        && />\s*知识库快照：/.test(content);
    checks.push({ id: 'metadata_tailnote', passed: hasMetadata });
    if (!hasMetadata) {
        errors.push('PRD 末尾必须包含生成元数据尾注');
    }

    return {
        status: errors.length > 0 ? 'block' : warnings.length > 0 ? 'warn' : 'pass',
        errors,
        warnings,
        checks,
    };
}

function validatePrdFile(filePath) {
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
            errors: [`PRD 文件不存在: ${filePath}`],
            warnings: [],
            checks: [],
        };
    }

    return validatePrdContent(fs.readFileSync(filePath, 'utf-8'));
}

function main() {
    const args = parseArgs(process.argv);
    const result = validatePrdFile(args.file);

    if (args.json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log(`PRD validation: ${result.status}`);
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
    validatePrdContent,
    validatePrdFile,
};
