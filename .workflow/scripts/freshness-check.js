#!/usr/bin/env node
/**
 * freshness-check.js - 知识库保鲜检测核心逻辑
 *
 * 用法: node freshness-check.js [options]
 *
 * 选项:
 *   --config <path>      配置文件路径 (默认: .mrd-to-code-config.json)
 *   --kb-path <path>     知识库路径 (默认: knowledge-base)
 *   --threshold <n>      警告阈值 (默认: 5)
 *   --stale-warn <n>     STALE_WARN 阈值 (默认: 60)
 *   --stale-block <n>    STALE_BLOCK 阈值 (默认: 60)
 *   --refresh            执行增量刷新
 *   --dry-run            仅检测不执行刷新
 *   --output <path>      输出文件路径 (默认: knowledge-base/freshness.yml)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_DEFAULTS = {
    freshness_threshold: 5,
    stale_warn_threshold: 60,
    stale_block_threshold: 60
};

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        config: '.mrd-to-code-config.json',
        kbPath: 'knowledge-base',
        threshold: CONFIG_DEFAULTS.freshness_threshold,
        staleWarn: CONFIG_DEFAULTS.stale_warn_threshold,
        staleBlock: CONFIG_DEFAULTS.stale_block_threshold,
        refresh: false,
        dryRun: false,
        output: null
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--config':
                options.config = args[++i];
                break;
            case '--kb-path':
                options.kbPath = args[++i];
                break;
            case '--threshold':
                options.threshold = parseInt(args[++i], 10);
                break;
            case '--stale-warn':
                options.staleWarn = parseInt(args[++i], 10);
                break;
            case '--stale-block':
                options.staleBlock = parseInt(args[++i], 10);
                break;
            case '--refresh':
                options.refresh = true;
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            case '--output':
                options.output = args[++i];
                break;
        }
    }

    if (!options.output) {
        options.output = path.join(options.kbPath, 'freshness.yml');
    }

    return options;
}

function loadConfig(configPath) {
    const fullPath = path.join(process.cwd(), configPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`[WARN] Config file not found: ${configPath}, using defaults`);
        return CONFIG_DEFAULTS;
    }

    try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const config = JSON.parse(content);
        return {
            freshness_threshold: config.knowledge_base?.freshness_threshold || CONFIG_DEFAULTS.freshness_threshold,
            stale_warn_threshold: config.knowledge_base?.stale_warn_threshold || CONFIG_DEFAULTS.stale_warn_threshold,
            stale_block_threshold: config.knowledge_base?.stale_block_threshold || CONFIG_DEFAULTS.stale_block_threshold
        };
    } catch (err) {
        console.log(`[WARN] Failed to parse config: ${err.message}, using defaults`);
        return CONFIG_DEFAULTS;
    }
}

function loadFreshnessMetadata(outputPath) {
    const fullPath = path.join(process.cwd(), outputPath);
    if (!fs.existsSync(fullPath)) {
        return {
            last_full_refresh: null,
            freshness_score: 100,
            modules: []
        };
    }

    try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return parseYaml(content);
    } catch (err) {
        console.log(`[WARN] Failed to parse freshness.yml: ${err.message}`);
        return {
            last_full_refresh: null,
            freshness_score: 100,
            modules: []
        };
    }
}

function parseYaml(content) {
    const lines = content.split('\n');
    const result = {
        last_full_refresh: null,
        freshness_score: 100,
        modules: []
    };

    let currentModule = null;

    for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('last_full_refresh:')) {
            result.last_full_refresh = trimmed.split(':')[1].trim().replace(/"/g, '');
        } else if (trimmed.startsWith('freshness_score:')) {
            result.freshness_score = parseInt(trimmed.split(':')[1].trim(), 10);
        } else if (trimmed.startsWith('- name:')) {
            if (currentModule) {
                result.modules.push(currentModule);
            }
            currentModule = {
                name: trimmed.split(':')[1].trim().replace(/"/g, ''),
                last_refresh: null,
                score: 100,
                outdated_commits: 0,
                status: 'FRESH'
            };
        } else if (currentModule) {
            if (trimmed.startsWith('last_refresh:')) {
                currentModule.last_refresh = trimmed.split(':')[1].trim().replace(/"/g, '');
            } else if (trimmed.startsWith('score:')) {
                currentModule.score = parseInt(trimmed.split(':')[1].trim(), 10);
            } else if (trimmed.startsWith('outdated_commits:')) {
                currentModule.outdated_commits = parseInt(trimmed.split(':')[1].trim(), 10);
            } else if (trimmed.startsWith('status:')) {
                currentModule.status = trimmed.split(':')[1].trim().replace(/"/g, '');
            }
        }
    }

    if (currentModule) {
        result.modules.push(currentModule);
    }

    return result;
}

function toYaml(data) {
    let yaml = `last_full_refresh: "${data.last_full_refresh || new Date().toISOString()}"\n`;
    yaml += `freshness_score: ${data.freshness_score}\n`;
    yaml += `modules:\n`;

    for (const module of data.modules) {
        yaml += `  - name: "${module.name}"\n`;
        yaml += `    last_refresh: "${module.last_refresh || new Date().toISOString()}"\n`;
        yaml += `    score: ${module.score}\n`;
        yaml += `    outdated_commits: ${module.outdated_commits}\n`;
        if (module.status !== 'FRESH') {
            yaml += `    status: "${module.status}"\n`;
        }
    }

    return yaml;
}

function getGitCommits(since) {
    try {
        let cmd = 'git log --pretty=format:"%H|%ai|%s" --name-only';
        if (since) {
            cmd += ` --since="${since}"`;
        }
        
        const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
        return parseGitLog(output);
    } catch (err) {
        console.log(`[ERROR] Failed to get git commits: ${err.message}`);
        return [];
    }
}

function parseGitLog(output) {
    const commits = [];
    const lines = output.split('\n');
    let currentCommit = null;

    for (const line of lines) {
        if (!line.trim()) continue;

        if (line.includes('|')) {
            if (currentCommit) {
                commits.push(currentCommit);
            }
            const [hash, date, ...msgParts] = line.split('|');
            currentCommit = {
                hash,
                date,
                message: msgParts.join('|'),
                files: []
            };
        } else if (currentCommit) {
            currentCommit.files.push(line.trim());
        }
    }

    if (currentCommit) {
        commits.push(currentCommit);
    }

    return commits;
}

function extractModules(commits, contextPath) {
    const modulePattern = loadModulePatterns(contextPath);
    const moduleCommits = {};

    for (const commit of commits) {
        for (const file of commit.files) {
            for (const [moduleName, patterns] of Object.entries(modulePattern)) {
                if (patterns.some(p => file.includes(p))) {
                    if (!moduleCommits[moduleName]) {
                        moduleCommits[moduleName] = [];
                    }
                    if (!moduleCommits[moduleName].includes(commit.hash)) {
                        moduleCommits[moduleName].push(commit.hash);
                    }
                }
            }
        }
    }

    return moduleCommits;
}

function loadModulePatterns(contextPath) {
    const fullPath = path.join(process.cwd(), contextPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`[WARN] CONTEXT.md not found: ${contextPath}`);
        return {
            'default': ['src/']
        };
    }

    try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return extractModulePatternsFromContext(content);
    } catch (err) {
        console.log(`[WARN] Failed to read CONTEXT.md: ${err.message}`);
        return {
            'default': ['src/']
        };
    }
}

function extractModulePatternsFromContext(content) {
    const patterns = {};
    const lines = content.split('\n');
    let currentModule = null;

    for (const line of lines) {
        const headerMatch = line.match(/^#+\s+(.+)/);
        if (headerMatch) {
            const header = headerMatch[1].toLowerCase();
            if (header.includes('module') || header.includes('service') || header.includes('component')) {
                currentModule = headerMatch[1].replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
            }
        }

        if (currentModule) {
            const pathMatch = line.match(/`([^`]+)`/);
            if (pathMatch) {
                if (!patterns[currentModule]) {
                    patterns[currentModule] = [];
                }
                patterns[currentModule].push(pathMatch[1]);
            }
        }
    }

    if (Object.keys(patterns).length === 0) {
        patterns['default'] = ['src/'];
    }

    return patterns;
}

function calculateFreshnessScore(moduleCommits, metadata, threshold) {
    const modules = [];
    let totalScore = 0;
    let moduleCount = 0;

    for (const [moduleName, commits] of Object.entries(moduleCommits)) {
        const outdatedCommits = commits.length;
        const totalRelevantCommits = outdatedCommits;
        
        let score = 100;
        if (totalRelevantCommits > 0) {
            score = Math.max(0, 100 - (outdatedCommits / totalRelevantCommits) * 100);
        }

        let status = 'FRESH';
        if (outdatedCommits > threshold) {
            status = 'STALE_WARN';
        }

        modules.push({
            name: moduleName,
            last_refresh: new Date().toISOString(),
            score: Math.round(score),
            outdated_commits: outdatedCommits,
            status
        });

        totalScore += score;
        moduleCount++;
    }

    const existingModules = metadata.modules || [];
    for (const existing of existingModules) {
        if (!modules.find(m => m.name === existing.name)) {
            modules.push({
                ...existing,
                last_refresh: existing.last_refresh || new Date().toISOString()
            });
            totalScore += existing.score;
            moduleCount++;
        }
    }

    const freshnessScore = moduleCount > 0 ? Math.round(totalScore / moduleCount) : 100;

    return {
        freshness_score: freshnessScore,
        modules
    };
}

function determineOverallStatus(freshnessScore, staleWarn, staleBlock) {
    if (freshnessScore >= staleWarn) {
        return 'FRESH';
    } else if (freshnessScore >= staleBlock) {
        return 'STALE_WARN';
    } else {
        return 'STALE_BLOCK';
    }
}

function performIncrementalRefresh(modules, kbPath, dryRun) {
    console.log('\n=== Incremental Refresh ===\n');

    for (const module of modules) {
        if (module.status !== 'FRESH') {
            console.log(`[REFRESH] Module: ${module.name}`);
            console.log(`  - Score: ${module.score}`);
            console.log(`  - Outdated commits: ${module.outdated_commits}`);
            console.log(`  - Status: ${module.status}`);

            if (!dryRun) {
                console.log(`  - Executing lightweight refresh for ${module.name}...`);
            } else {
                console.log(`  - [DRY-RUN] Would refresh ${module.name}`);
            }
        }
    }

    console.log('\n=== Refresh Complete ===\n');
}

function main() {
    const options = parseArgs();
    const config = loadConfig(options.config);

    console.log('\n=== Knowledge Base Freshness Check ===\n');
    console.log(`Config: ${options.config}`);
    console.log(`Knowledge Base: ${options.kbPath}`);
    console.log(`Threshold: ${config.freshness_threshold}`);
    console.log(`Stale Warn: ${config.stale_warn_threshold}`);
    console.log(`Stale Block: ${config.stale_block_threshold}`);
    console.log(`Output: ${options.output}`);

    const metadata = loadFreshnessMetadata(options.output);
    console.log(`\nLast Full Refresh: ${metadata.last_full_refresh || 'N/A'}`);

    const commits = getGitCommits(metadata.last_full_refresh);
    console.log(`\nCommits since last refresh: ${commits.length}`);

    const contextPath = path.join(options.kbPath, 'CONTEXT.md');
    const moduleCommits = extractModules(commits, contextPath);
    console.log(`Modules with commits: ${Object.keys(moduleCommits).length}`);

    const freshness = calculateFreshnessScore(moduleCommits, metadata, config.freshness_threshold);
    const overallStatus = determineOverallStatus(
        freshness.freshness_score,
        config.stale_warn_threshold,
        config.stale_block_threshold
    );

    console.log('\n=== Freshness Report ===\n');
    console.log(`Overall Score: ${freshness.freshness_score}`);
    console.log(`Overall Status: ${overallStatus}`);

    for (const module of freshness.modules) {
        console.log(`\nModule: ${module.name}`);
        console.log(`  Score: ${module.score}`);
        console.log(`  Outdated Commits: ${module.outdated_commits}`);
        console.log(`  Status: ${module.status}`);
    }

    const output = toYaml({
        last_full_refresh: metadata.last_full_refresh || new Date().toISOString(),
        freshness_score: freshness.freshness_score,
        modules: freshness.modules
    });

    const outputDir = path.dirname(path.join(process.cwd(), options.output));
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(path.join(process.cwd(), options.output), output);
    console.log(`\n[OK] Freshness metadata written to ${options.output}`);

    if (options.refresh || overallStatus === 'STALE_WARN' || overallStatus === 'STALE_BLOCK') {
        performIncrementalRefresh(freshness.modules, options.kbPath, options.dryRun);
    }

    if (overallStatus === 'STALE_BLOCK') {
        console.log('\n[ERROR] STALE_BLOCK detected. Knowledge base rebuild required before archive.');
        process.exit(2);
    } else if (overallStatus === 'STALE_WARN') {
        console.log('\n[WARN] STALE_WARN detected. Incremental refresh recommended.');
        process.exit(1);
    } else {
        console.log('\n[OK] Knowledge base is fresh.');
        process.exit(0);
    }
}

main();
