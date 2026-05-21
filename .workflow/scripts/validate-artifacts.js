#!/usr/bin/env node
/**
 * validate-artifacts.js - 产物存在性校验
 *
 * 用法: node validate-artifacts.js [--phase <phase>] [--strict]
 *
 * 检查关键产物是否存在、大小是否合理
 */

const fs = require('fs');
const path = require('path');

const PHASE = process.argv.includes('--phase')
    ? process.argv[process.argv.indexOf('--phase') + 1]
    : null;
const STRICT = process.argv.includes('--strict');
const STATE_FILE = path.join(process.cwd(), '.workflow', 'execution-state.md');

const PHASE_ARTIFACTS = {
    '00-mrd': ['artifacts/mrd/*.md'],
    '01-knowledge-base': ['app-knowledge-base/**/*.md'],
    '02-implementation-plan': [
        'req/**/prd.md',
        'req/**/tech-design.md',
        '.workflow/execution-state.md'
    ],
    '03-code-gen-tdd': [
        'src/**/*.java',
        'src/test/**/*.java',
        '.workflow/execution-state.md'
    ],
    '04-archive': [
        '.workflow/execution-state.md',
        'archive-report.md'
    ]
};

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

function checkArtifact(pattern, baseDir = process.cwd()) {
    const matches = pattern.includes('*')
        ? walkFiles(baseDir)
            .map(file => path.relative(baseDir, file))
            .filter(file => file.toLowerCase().endsWith(pattern.split('**/').pop().replace('*', '').toLowerCase()))
        : fs.existsSync(path.join(baseDir, pattern)) ? [pattern] : [];

    if (matches.length === 0) {
        return { pattern, exists: false, count: 0, files: [] };
    }

    const files = matches.map(f => {
        const fullPath = path.join(baseDir, f);
        const stats = fs.existsSync(fullPath) ? fs.statSync(fullPath) : null;
        return {
            path: f,
            size: stats ? stats.size : 0,
            valid: stats && stats.size > 0
        };
    });

    return {
        pattern,
        exists: true,
        count: matches.length,
        files
    };
}

function validatePhase(phase) {
    const patterns = PHASE_ARTIFACTS[phase] || [];
    const results = [];

    console.log(`\n=== Validating Phase: ${phase} ===\n`);

    patterns.forEach(pattern => {
        const result = checkArtifact(pattern);
        results.push(result);

        if (result.exists) {
            console.log(`[PASS] ${pattern} (${result.count} file(s))`);
            result.files.forEach(f => {
                if (f.size < 10 && STRICT) {
                    console.log(`  [WARN] ${f.path} is too small (${f.size} bytes)`);
                } else {
                    console.log(`  [OK] ${f.path} (${f.size} bytes)`);
                }
            });
        } else {
            console.log(`[FAIL] ${pattern} - NOT FOUND`);
        }
    });

    const passed = results.filter(r => r.exists).length;
    const failed = results.filter(r => !r.exists).length;
    const total = results.length;

    console.log(`\n=== Summary: ${passed}/${total} passed, ${failed} failed ===\n`);

    return { passed, failed, total, results };
}

function readStateFile() {
    if (!fs.existsSync(STATE_FILE)) {
        return null;
    }
    const content = fs.readFileSync(STATE_FILE, 'utf-8');
    const match = content.match(/current_phase:\s*(.+)/);
    return match ? match[1].trim() : null;
}

function main() {
    let phase = PHASE;

    if (!phase) {
        phase = readStateFile();
    }

    if (!phase) {
        console.log('[ERROR] No phase specified and could not read from state file');
        console.log('Usage: node validate-artifacts.js [--phase <phase>] [--strict]');
        process.exit(1);
    }

    const result = validatePhase(phase);

    if (result.failed > 0) {
        process.exit(1);
    }

    process.exit(0);
}

main();
