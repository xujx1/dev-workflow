#!/usr/bin/env node
/**
 * fix-execution-state.js - 修复 execution-state.md 缺失字段
 *
 * 用法: node fix-execution-state.js [--dry-run] [--field <field>=<value>]
 *
 * 允许修复的字段（来自 orchestrator-safe-ops.yml）:
 *   - current_phase
 *   - artifact_paths
 *   - started_at
 *   - last_updated_at
 *   - status
 *   - error_message
 */

const fs = require('fs');
const path = require('path');

const ALLOWED_FIELDS = [
    'current_phase',
    'artifact_paths',
    'started_at',
    'last_updated_at',
    'status',
    'error_message'
];

const DISALLOWED_FIELDS = [
    'review_conclusion',
    'test_result',
    'code_changes',
    'implementation_details'
];

const DRY_RUN = process.argv.includes('--dry-run');
const STATE_FILE = path.join(process.cwd(), '.workflow', 'execution-state.md');
const AUDIT_LOG = path.join(process.cwd(), '.workflow', 'ops-audit.log');

function logAudit(op, field, before, after, result) {
    const entry = {
        ts: new Date().toISOString(),
        op,
        field,
        before,
        after,
        result
    };
    fs.appendFileSync(AUDIT_LOG, JSON.stringify(entry) + '\n');
}

function parseFrontMatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { fields: {}, body: content };

    const yamlStr = match[1];
    const body = match[2];
    const fields = {};

    yamlStr.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
            fields[key.trim()] = valueParts.join(':').trim();
        }
    });

    return { fields, body };
}

function updateFrontMatter(content, updates) {
    const { fields, body } = parseFrontMatter(content);
    const timestamp = new Date().toISOString();

    Object.entries(updates).forEach(([key, value]) => {
        if (ALLOWED_FIELDS.includes(key)) {
            const before = fields[key] || null;
            fields[key] = value;
            logAudit('fix_execution_state', key, before, value, 'ok');
            console.log(`[UPDATE] ${key}: ${before || '(null)'} -> ${value}`);
        } else if (DISALLOWED_FIELDS.includes(key)) {
            console.log(`[BLOCKED] Cannot modify disallowed field: ${key}`);
            logAudit('fix_execution_state', key, null, null, 'blocked');
        }
    });

    // 确保 last_updated_at 被更新
    fields.last_updated_at = timestamp;

    let yamlLines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
    yamlLines.push(`last_updated_at: ${timestamp}`);

    return `---\n${yamlLines.join('\n')}\n---\n${body}`;
}

function main() {
    const args = process.argv.slice(2).filter(a => !a.startsWith('--'));

    if (args.length === 0) {
        console.log('Usage: node fix-execution-state.js [--dry-run] [--field <field>=<value>]');
        console.log(`Allowed fields: ${ALLOWED_FIELDS.join(', ')}`);
        process.exit(1);
    }

    if (!fs.existsSync(STATE_FILE)) {
        console.log(`[ERROR] State file not found: ${STATE_FILE}`);
        process.exit(1);
    }

    const content = fs.readFileSync(STATE_FILE, 'utf-8');
    const updates = {};

    args.forEach(arg => {
        const [key, value] = arg.split('=');
        if (key && value !== undefined) {
            updates[key.trim()] = value.trim();
        }
    });

    if (Object.keys(updates).length === 0) {
        console.log('[INFO] No valid updates provided');
        process.exit(0);
    }

    const newContent = updateFrontMatter(content, updates);

    if (DRY_RUN) {
        console.log('[DRY-RUN] Would update state to:');
        console.log(newContent);
    } else {
        fs.writeFileSync(STATE_FILE, newContent, 'utf-8');
        console.log(`[DONE] Updated ${STATE_FILE}`);
    }
}

main();
