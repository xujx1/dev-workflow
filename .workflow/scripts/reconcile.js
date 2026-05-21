#!/usr/bin/env node
/**
 * reconcile.js - 差异报告生成（只读操作）
 *
 * 用法: node reconcile.js [--output <file>]
 *
 * 对比 execution-state、Beads、git diff，生成差异摘要
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_FILE = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : '.workflow/reconcile-report.md';
const STATE_FILE = path.join(process.cwd(), '.workflow', 'execution-state.md');
const BEADS_FILE = path.join(process.cwd(), '.beads', 'tasks.json');
const AUDIT_LOG = path.join(process.cwd(), '.workflow', 'ops-audit.log');

function logAudit(op, details, result) {
    const entry = {
        ts: new Date().toISOString(),
        op,
        ...details,
        result
    };
    fs.appendFileSync(AUDIT_LOG, JSON.stringify(entry) + '\n');
}

function readExecutionState() {
    if (!fs.existsSync(STATE_FILE)) {
        return null;
    }
    return fs.readFileSync(STATE_FILE, 'utf-8');
}

function readBeads() {
    if (!fs.existsSync(BEADS_FILE)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(BEADS_FILE, 'utf-8'));
    } catch (e) {
        return null;
    }
}

function getGitDiff() {
    try {
        const diff = execSync('git diff --stat', { encoding: 'utf-8' });
        return diff;
    } catch (e) {
        return null;
    }
}

function getGitStatus() {
    try {
        const status = execSync('git status --porcelain', { encoding: 'utf-8' });
        return status;
    } catch (e) {
        return null;
    }
}

function parseStateFile(content) {
    const result = {
        current_phase: null,
        artifact_paths: {},
        status: null,
        last_updated: null
    };

    const lines = content.split('\n');
    lines.forEach(line => {
        if (line.startsWith('current_phase:')) {
            result.current_phase = line.split(':').slice(1).join(':').trim();
        } else if (line.startsWith('status:')) {
            result.status = line.split(':').slice(1).join(':').trim();
        } else if (line.startsWith('last_updated_at:')) {
            result.last_updated = line.split(':').slice(1).join(':').trim();
        }
    });

    return result;
}

function generateReport(stateData, beadsData, gitDiff, gitStatus) {
    const timestamp = new Date().toISOString();
    const lines = [];

    lines.push(`# Reconcile 差异报告`);
    lines.push(`\n生成时间: ${timestamp}\n`);
    lines.push('---\n');
    lines.push('## 1. Execution State vs Beads 对比\n');

    if (stateData && beadsData) {
        const statePhase = stateData.current_phase || 'unknown';
        const beadsTasks = beadsData.tasks || [];
        const beadsPhase = beadsTasks[0]?.phase || 'unknown';

        if (statePhase !== beadsPhase) {
            lines.push(`| 项目 | Execution State | Beads |`);
            lines.push(`|------|-----------------|-------|`);
            lines.push(`| Phase | ${statePhase} | ${beadsPhase} |`);
            lines.push(`\n**差异**: Phase 不匹配\n`);
        } else {
            lines.push(`**一致**: Phase 均为 ${statePhase}\n`);
        }
    } else {
        lines.push('**无法对比**: 缺少 state 或 beads 数据\n');
    }

    lines.push('## 2. Git 变更摘要\n');

    if (gitDiff) {
        lines.push('```');
        lines.push(gitDiff);
        lines.push('```\n');
    } else {
        lines.push('**无 Git 变更或非 Git 仓库**\n');
    }

    lines.push('## 3. 未提交文件\n');

    if (gitStatus && gitStatus.trim()) {
        lines.push('```');
        lines.push(gitStatus);
        lines.push('```\n');
    } else {
        lines.push('**工作区干净，无未提交文件**\n');
    }

    lines.push('---\n');
    lines.push(`*此报告由 reconcile.js 自动生成，仅供参考*\n`);

    return lines.join('\n');
}

function main() {
    console.log('=== Reconciliation Report Generator ===\n');

    const stateContent = readExecutionState();
    const beadsData = readBeads();
    const gitDiff = getGitDiff();
    const gitStatus = getGitStatus();

    const stateData = stateContent ? parseStateFile(stateContent) : null;

    console.log('Data sources:');
    console.log(`  - Execution State: ${stateContent ? 'OK' : 'MISSING'}`);
    console.log(`  - Beads Tasks: ${beadsData ? 'OK' : 'MISSING'}`);
    console.log(`  - Git Diff: ${gitDiff ? 'OK' : 'N/A'}`);
    console.log(`  - Git Status: ${gitStatus ? 'OK' : 'N/A'}`);

    const report = generateReport(stateData, beadsData, gitDiff, gitStatus);

    fs.writeFileSync(OUTPUT_FILE, report, 'utf-8');
    console.log(`\n[OK] Report written to: ${OUTPUT_FILE}`);

    logAudit('reconcile_report', {
        state_file: STATE_FILE,
        beads_file: BEADS_FILE,
        output: OUTPUT_FILE
    }, 'ok');
}

main();
