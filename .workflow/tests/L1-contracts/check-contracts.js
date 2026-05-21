#!/usr/bin/env node
/**
 * L1 静态契约测试：检查 Skill 是否满足基本协议约束
 *
 * 执行方式: node check-contracts.js
 * 执行时间: < 30s
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SKILLS_DIR = path.resolve(__dirname, '../../../skills');
const REPO_ROOT = path.resolve(SKILLS_DIR, '..');
const SCHEMA_PATH = path.resolve(__dirname, 'skill-contract.schema.yaml');
const REPORT_PATH = path.resolve(__dirname, 'reports/contract-check-report.md');

// ANSI color codes
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let schema;
let report = [];
let passCount = 0;
let failCount = 0;

/**
 * 解析 YAML frontmatter
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  try {
    return yaml.load(match[1]) || {};
  } catch (e) {
    return { _parseError: e.message };
  }
}

/**
 * 读取 SKILL.md 文件内容
 */
function readSkillFile(skillPath) {
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return null;
  }
  return fs.readFileSync(skillMdPath, 'utf-8');
}

/**
 * 检查必需的前置字段
 */
function checkRequiredFrontmatter(frontmatter, skillName) {
  const errors = [];
  const requiredFields = schema.contract_fields.required_frontmatter;

  for (const field of requiredFields) {
    if (frontmatter[field] === undefined || frontmatter[field] === null) {
      errors.push(`缺少必需字段: ${field}`);
    }
  }

  // 检查 name 字段是否与目录名一致
  const normalizedSkillName = skillName.replace(/^\d+-/, '');
  if (frontmatter.name && frontmatter.name !== skillName && frontmatter.name !== normalizedSkillName) {
    errors.push(`name 字段 "${frontmatter.name}" 与目录名 "${skillName}" 不一致`);
  }

  return errors;
}

/**
 * 检查必需的部分
 */
function checkRequiredSections(content, skillName) {
  const errors = [];
  const requiredSections = schema.contract_fields.required_sections;

  for (const section of requiredSections) {
    const regex = new RegExp(section);
    if (!regex.test(content)) {
      errors.push(`缺少必需章节: ${section}`);
    }
  }

  return errors;
}

/**
 * 检查 Skill 特定约束
 */
function checkSkillConstraints(frontmatter, content, skillName) {
  const errors = [];
  const constraints = schema.skill_constraints[skillName];

  if (!constraints) {
    return errors; // 未定义的 Skill 暂不检查特定约束
  }

  // 检查必需的 agents
  if (constraints.must_have_agents) {
    const skillAgentDir = path.join(SKILLS_DIR, skillName, 'agents');
    const rootAgentDir = path.join(REPO_ROOT, 'agents');
    const agentDirs = [skillAgentDir, rootAgentDir].filter(dir => fs.existsSync(dir));
    if (agentDirs.length > 0) {
      const agents = agentDirs.flatMap(agentDir => fs.readdirSync(agentDir).flatMap(f => {
        const entryPath = path.join(agentDir, f);
        const stat = fs.statSync(entryPath);
        if (f.endsWith('-agent.md') || stat.isDirectory()) {
          const nested = stat.isDirectory()
            ? fs.readdirSync(entryPath).filter(nestedFile => nestedFile.endsWith('-agent.md'))
            : [];
          return [f, ...nested];
        }
        return [];
      }));
      const missingAgents = constraints.must_have_agents.filter(
        required => !agents.some(a => a.includes(required) || a === required)
      );
      if (missingAgents.length > 0) {
        errors.push(`缺少必需 Agent: ${missingAgents.join(', ')}`);
      }
    } else {
      errors.push(`agents 目录不存在，但 Skill 声明了必需 Agent`);
    }
  }

  // 检查必需输出的描述
  if (constraints.required_outputs) {
    const hasOutputSection = /产出|输出/.test(content);
    if (!hasOutputSection) {
      errors.push(`缺少产出说明章节`);
    }
  }

  // 检查状态更新字段
  if (constraints.enforce_state_update_fields && constraints.state_update_fields) {
    for (const field of constraints.state_update_fields) {
      if (!content.includes(field)) {
        errors.push(`未声明状态更新字段: ${field}`);
      }
    }
  }

  // 检查必须引用的文件或命令
  if (constraints.must_reference) {
    for (const reference of constraints.must_reference) {
      if (!content.includes(reference)) {
        errors.push(`未引用必需内容: ${reference}`);
      }
    }
  }

  // 检查 Skill assets 是否存在
  if (constraints.must_have_assets) {
    for (const asset of constraints.must_have_assets) {
      const assetPath = path.join(SKILLS_DIR, skillName, asset);
      if (!fs.existsSync(assetPath)) {
        errors.push(`缺少必需资产文件: ${asset}`);
      }
    }
  }

  // 检查 forbidden operations
  if (constraints.forbidden_operations) {
    for (const forbidden of constraints.forbidden_operations) {
      const pattern = new RegExp(forbidden, 'm');
      if (pattern.test(content)) {
        errors.push(`包含禁止的操作: ${forbidden}`);
      }
    }
  }

  return errors;
}

/**
 * 检查协同模型约束
 */
function checkExecutionConstraints(content, skillName) {
  const errors = [];

  // 检查是否使用严格阻塞执行
  if (content.includes('严格阻塞') || content.includes('严格阻塞执行')) {
    // 正确使用了阻塞
  }

  // 检查禁止后台模式
  if (skillName === '02-implementation-plan' || skillName === '03-code-gen-tdd') {
    if (!content.includes('run_in_background') && !content.includes('后台模式')) {
      // 需要在协同模型中明确说明
    }
  }

  return errors;
}

/**
 * 检查版本格式
 */
function checkVersionFormat(version) {
  if (!version) return false;
  const versionRegex = /^v\d+\.\d+\.\d+$/;
  return versionRegex.test(version);
}

/**
 * 验证单个 Skill
 */
function validateSkill(skillName) {
  const skillPath = path.join(SKILLS_DIR, skillName);
  const content = readSkillFile(skillPath);

  if (!content) {
    return {
      name: skillName,
      status: 'skip',
      errors: ['SKILL.md 文件不存在']
    };
  }

  const frontmatter = parseFrontmatter(content);
  const allErrors = [];

  // 1. 检查前置字段
  allErrors.push(...checkRequiredFrontmatter(frontmatter, skillName));

  // 2. 检查必需章节
  allErrors.push(...checkRequiredSections(content, skillName));

  // 3. 检查 Skill 特定约束
  allErrors.push(...checkSkillConstraints(frontmatter, content, skillName));

  // 4. 检查执行约束
  allErrors.push(...checkExecutionConstraints(content, skillName));

  // 5. 检查版本格式
  if (frontmatter.version && !checkVersionFormat(frontmatter.version)) {
    allErrors.push(`版本格式不正确，应为 vX.Y.Z，当前: ${frontmatter.version}`);
  }

  return {
    name: skillName,
    status: allErrors.length === 0 ? 'pass' : 'fail',
    errors: allErrors,
    version: frontmatter.version || 'unknown',
    description: frontmatter.description || ''
  };
}

/**
 * 生成 Markdown 报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const status = failCount === 0 ? 'PASS' : 'FAIL';

  let md = `# L1 契约检查报告

生成时间: ${timestamp}
检查路径: ${SKILLS_DIR}

## 汇总

| 指标 | 数值 |
|------|------|
| 总 Skills | ${passCount + failCount} |
| 通过 | ${passCount} |
| 失败 | ${failCount} |
| 状态 | ${status} |

## 详细结果

`;

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'skip' ? '⏭️' : '❌';
    md += `### ${icon} ${result.name}\n\n`;
    md += `- 版本: ${result.version}\n`;
    md += `- 描述: ${result.description.substring(0, 80)}...\n\n`;

    if (result.errors.length > 0) {
      md += `**违规项:**\n`;
      for (const error of result.errors) {
        md += `- ${error}\n`;
      }
    }
    md += '\n';
  }

  md += `---\n\n`;
  md += `*本报告由 check-contracts.js 自动生成*\n`;

  return md;
}

/**
 * 打印彩色结果
 */
function printResults() {
  console.log(`\n${BLUE}${'='.repeat(60)}${RESET}`);
  console.log(`${BLUE}L1 静态契约测试${RESET}`);
  console.log(`${BLUE}${'='.repeat(60)}${RESET}\n`);

  for (const result of results) {
    if (result.status === 'pass') {
      console.log(`${GREEN}✅ ${result.name}${RESET} (${result.version})`);
    } else if (result.status === 'skip') {
      console.log(`${YELLOW}⏭️  ${result.name}${RESET} - SKIP`);
    } else {
      console.log(`${RED}❌ ${result.name}${RESET}`);
      for (const error of result.errors) {
        console.log(`   ${RED}- ${error}${RESET}`);
      }
    }
  }

  console.log(`\n${BLUE}${'='.repeat(60)}${RESET}`);
  console.log(`汇总: ${GREEN}${passCount} passed${RESET}, ${RED}${failCount} failed${RESET}`);
  console.log(`${BLUE}${'='.repeat(60)}${RESET}\n`);
}

// 主执行流程
async function main() {
  try {
    // 加载 schema
    schema = yaml.load(fs.readFileSync(SCHEMA_PATH, 'utf-8'));

    // 获取所有 Skill 目录
    if (!fs.existsSync(SKILLS_DIR)) {
      console.error(`${RED}错误: Skills 目录不存在: ${SKILLS_DIR}${RESET}`);
      process.exit(1);
    }

    const skillDirs = fs.readdirSync(SKILLS_DIR)
      .filter(f => {
        const stat = fs.statSync(path.join(SKILLS_DIR, f));
        return stat.isDirectory() && !f.startsWith('.');
      })
      .filter(name => schema.core_skills.includes(name) || !schema.core_skills);

    console.log(`\n${BLUE}检查 ${skillDirs.length} 个 Skills...${RESET}\n`);

    for (const skillName of skillDirs) {
      const result = validateSkill(skillName);
      results.push(result);

      if (result.status === 'pass') {
        passCount++;
      } else if (result.status === 'fail') {
        failCount++;
      }
    }

    // 确保 reports 目录存在
    const reportsDir = path.dirname(REPORT_PATH);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // 生成并保存报告
    const reportContent = generateReport();
    fs.writeFileSync(REPORT_PATH, reportContent, 'utf-8');

    // 打印彩色结果
    printResults();

    console.log(`报告已保存: ${REPORT_PATH}\n`);

    // 返回退出码
    process.exit(failCount > 0 ? 1 : 0);

  } catch (error) {
    console.error(`${RED}错误: ${error.message}${RESET}`);
    console.error(error.stack);
    process.exit(1);
  }
}

const results = [];
main();
