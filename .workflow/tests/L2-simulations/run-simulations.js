#!/usr/bin/env node
/**
 * L2 流程模拟测试：验证 Orchestrator 在各种异常状态下的行为是否符合预期
 *
 * 执行方式: node run-simulations.js
 * 执行时间: < 2min（不依赖真实 LLM）
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { validatePrdFile } = require('../../scripts/validate-prd');
const { validateTechDesignFile } = require('../../scripts/validate-tech-design');
const { validateStage02, validateExecutionState } = require('../../scripts/validate-stage02-gates');

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const REPORT_PATH = path.resolve(__dirname, 'reports/simulation-report.md');

// ANSI color codes
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let passCount = 0;
let failCount = 0;
let skipCount = 0;
let results = [];

/**
 * 解析 Markdown 格式的 execution-state.md
 */
function parseExecutionState(content) {
  const state = {
    rawContent: content,
    metadata: {},
    current_stage: null,
    last_completed_phase: null,
    next_phase: null,
    artifacts: {},
    autofix: {},
    model_routing: {},
    beads_state: {},
    execution_state_recorded: {},
    reconcile_result: {},
    phase_status: {}
  };

  let currentSection = null;
  const lines = content.split('\n');

  for (const line of lines) {
    // 解析节标题
    const sectionMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (sectionMatch) {
      currentSection = sectionMatch[2].trim();
      continue;
    }

    // 解析键值对
    const kvMatch = line.match(/^-\s+(\w+(?:\.\w+)*):\s+(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim();

      if (currentSection === '元数据' || currentSection === 'metadata') {
        state.metadata[key] = value;
      } else if (currentSection === '当前状态' || currentSection === 'current_state') {
        if (key === 'current_stage') state.current_stage = value;
        else if (key === 'last_completed_phase') state.last_completed_phase = value;
        else if (key === 'next_phase') state.next_phase = value;
      } else if (currentSection === '阶段状态' || currentSection === 'phase_status') {
        if (!state.phase_status[currentSection]) state.phase_status[currentSection] = {};
      } else if (line.includes('- path:')) {
        // 处理 artifacts 数组
      }
    }

    // 解析简单键值（无缩进的）
    const simpleMatch = line.match(/^(\w+(?:_\w+)*):\s*(.+)$/);
    if (simpleMatch && currentSection) {
      const key = simpleMatch[1];
      const value = simpleMatch[2].trim();

      if (key === 'current_stage') state.current_stage = value;
      else if (key === 'last_completed_phase') state.last_completed_phase = value;
      else if (key === 'next_phase') state.next_phase = value;
      else if (key === 'status') {
        // 记录当前节的状态
      }
    }
  }

  // 简单解析：提取关键字段
  const stageMatch = content.match(/current_stage:\s*(\S+)/);
  const lastPhaseMatch = content.match(/last_completed_phase:\s*(\S+)/);
  const nextPhaseMatch = content.match(/next_phase:\s*(\S+)/);

  if (stageMatch) state.current_stage = stageMatch[1];
  if (lastPhaseMatch) state.last_completed_phase = lastPhaseMatch[1];
  if (nextPhaseMatch) state.next_phase = nextPhaseMatch[1];

  // 解析 autofix
  const autofixAttemptsMatch = content.match(/attempts:\s*(\d+)/);
  const autofixMaxMatch = content.match(/max_attempts:\s*(\d+)/);
  const autofixStatusMatch = content.match(/autofix[\s\S]*?status:\s*(\S+)/);

  if (autofixAttemptsMatch) state.autofix.attempts = parseInt(autofixAttemptsMatch[1]);
  if (autofixMaxMatch) state.autofix.max_attempts = parseInt(autofixMaxMatch[1]);
  if (autofixStatusMatch) state.autofix.status = autofixStatusMatch[1];

  // 解析 model_routing
  const modelRoutingMatch = content.match(/model_routing:\s*\n\s*configured:\s*(true|false)/);
  if (modelRoutingMatch) state.model_routing.configured = modelRoutingMatch[1] === 'true';

  // 解析 beads 状态
  const beadsStatusMatch = content.match(/beads_state:[\s\S]*?phase4_task:[\s\S]*?status:\s*"?(\w+)"?/);
  if (beadsStatusMatch) state.beads_state.phase4_status = beadsStatusMatch[1];

  // 解析 reconcile 结果
  const reconcileMatch = content.match(/inconsistencies_found:\s*(\d+)/);
  if (reconcileMatch) state.reconcile_result.inconsistencies_found = parseInt(reconcileMatch[1]);

  return state;
}

/**
 * 解析 expected-output.yaml
 */
function parseExpectedOutput(content) {
  try {
    const parsed = yaml.load(content);
    if (parsed && parsed.expected_output) {
      return parsed;
    }
  } catch (e) {
    // 继续走 Markdown 兼容解析
  }

  const expectedMatch = content.match(/expected_output:\s*\n([\s\S]*?)(?:\n\S|$)/);
  if (!expectedMatch) {
    return {};
  }

  try {
    return {
      expected_output: yaml.load(`expected_output:\n${expectedMatch[1]}`).expected_output
    };
  } catch {
    return {};
  }
}

/**
 * SIM_01: Resume Stage 03
 * 验证：execution-state 显示 Stage 02 完成，产物存在 -> 直接跳到 Stage 03
 */
function simulateSIM01(state, expected) {
  // 模拟 Orchestrator 逻辑
  const artifacts = extractArtifacts(state);

  if (artifacts.allExist) {
    return {
      actual: {
        orchestrator_action: 'resume_phase3',
        next_phase: state.next_phase || 'phase3'
      },
      matches: expected.expected_output.next_phase === (state.next_phase || 'phase3')
    };
  }

  return {
    actual: { orchestrator_action: 'block', reason: 'artifacts_missing' },
    matches: false
  };
}

/**
 * SIM_02: Missing PRD
 * 验证：PRD 产物缺失 -> pre-stage doctor 返回 block
 */
function simulateSIM02(state, expected) {
  const artifacts = extractArtifacts(state);
  const prdExists = artifacts.prd;

  if (!prdExists) {
    return {
      actual: {
        orchestrator_action: 'block',
        block_reason: 'PRD 产物缺失，请重新执行 Stage 02'
      },
      matches: expected.expected_output.status === 'blocked'
    };
  }

  return {
    actual: { orchestrator_action: 'resume_phase3' },
    matches: false
  };
}

/**
 * SIM_03: Autofix Max Attempts
 * 验证：autofix.attempts = max_attempts -> 停止 autofix loop
 */
function simulateSIM03(state, expected) {
  const attempts = state.autofix?.attempts || 0;
  const maxAttempts = state.autofix?.max_attempts || 3;

  if (attempts >= maxAttempts) {
    return {
      actual: {
        orchestrator_action: 'stop_autofix_loop',
        status: 'FAILED_MAX_ATTEMPTS',
        final_attempt: attempts,
        max_attempts: maxAttempts
      },
      matches: expected.expected_output.status === 'FAILED_MAX_ATTEMPTS'
    };
  }

  return {
    actual: { orchestrator_action: 'continue_autofix' },
    matches: false
  };
}

/**
 * SIM_04: Model Routing Not Configured
 * 验证：model_routing 未配置 -> 退化为 baseline 单模型
 */
function simulateSIM04(state, expected) {
  const configured = state.model_routing?.configured;

  if (configured === false || configured === undefined) {
    return {
      actual: {
        orchestrator_action: 'degrade_to_baseline',
        degraded_to: 'claude-sonnet-4-20250514',
        warn_logged: true
      },
      matches: expected.expected_output.status === 'degraded'
    };
  }

  return {
    actual: { orchestrator_action: 'use_model_routing' },
    matches: false
  };
}

/**
 * SIM_05: Reconcile Beads State Mismatch
 * 验证：Beads 任务已关闭但 execution-state 显示 in-progress -> reconcile 报告生成 warn
 */
function simulateSIM05(state, expected) {
  const beadsStatus = state.beads_state?.phase4_status;
  const inconsistencies = state.reconcile_result?.inconsistencies_found || 0;

  if (beadsStatus === 'done' && inconsistencies > 0) {
    return {
      actual: {
        orchestrator_action: 'generate_reconcile_report',
        status: 'reconcile_warning',
        warn_logged: true
      },
      matches: expected.expected_output.status === 'reconcile_warning'
    };
  }

  return {
    actual: { orchestrator_action: 'continue' },
    matches: false
  };
}

/**
 * SIM_06: PRD 章节结构不合规
 * 验证：PRD 未按一~七模板输出 -> Stage 2 gate block
 */
function simulateSIM06(fixtureDir, expected) {
  const prdPath = path.join(fixtureDir, 'prd.md');
  const validation = validatePrdFile(prdPath);
  return {
    actual: {
      orchestrator_action: validation.status === 'block' ? 'block' : 'continue',
      status: validation.status,
      errors: validation.errors
    },
    matches: expected.expected_output.status === validation.status
      && validation.errors.some(error => error.includes('缺少 PRD 模板章节'))
  };
}

/**
 * SIM_07: PRD 包含 ASCII art
 * 验证：ASCII art 未替换为 Mermaid flowchart -> Stage 2 gate block
 */
function simulateSIM07(fixtureDir, expected) {
  const prdPath = path.join(fixtureDir, 'prd.md');
  const validation = validatePrdFile(prdPath);
  return {
    actual: {
      orchestrator_action: validation.status === 'block' ? 'block' : 'continue',
      status: validation.status,
      errors: validation.errors
    },
    matches: expected.expected_output.status === validation.status
      && validation.errors.some(error => error.includes('ASCII art'))
  };
}

/**
 * SIM_08: PRD 缺少元数据尾注
 * 验证：PRD 没有生成元数据 -> Stage 2 gate block
 */
function simulateSIM08(fixtureDir, expected) {
  const prdPath = path.join(fixtureDir, 'prd.md');
  const validation = validatePrdFile(prdPath);
  return {
    actual: {
      orchestrator_action: validation.status === 'block' ? 'block' : 'continue',
      status: validation.status,
      errors: validation.errors
    },
    matches: expected.expected_output.status === validation.status
      && validation.errors.some(error => error.includes('生成元数据尾注'))
  };
}

function simulateStage02GateFixture(fixtureDir, expected, expectedErrorFragment) {
  const validation = validateStage02(fixtureDir);
  return {
    actual: {
      orchestrator_action: validation.status === 'block' ? 'block' : 'continue',
      status: validation.status,
      errors: validation.errors
    },
    matches: expected.expected_output.status === validation.status
      && validation.errors.some(error => error.includes(expectedErrorFragment))
  };
}

function simulateExecutionStateGateFixture(fixtureDir, expected, expectedErrorFragment) {
  const validation = validateExecutionState(path.join(fixtureDir, 'execution-state.md'));
  return {
    actual: {
      orchestrator_action: validation.status === 'block' ? 'block' : 'continue',
      status: validation.status,
      errors: validation.errors
    },
    matches: expected.expected_output.status === validation.status
      && validation.errors.some(error => error.includes(expectedErrorFragment))
  };
}

function simulateTechDesignFixture(fixtureDir, expected, expectedErrorFragment) {
  const validation = validateTechDesignFile(path.join(fixtureDir, 'tech-design.md'));
  return {
    actual: {
      orchestrator_action: validation.status === 'block' ? 'block' : 'continue',
      status: validation.status,
      errors: validation.errors
    },
    matches: expected.expected_output.status === validation.status
      && validation.errors.some(error => error.includes(expectedErrorFragment))
  };
}

/**
 * 从 state 中提取 artifacts 信息
 */
function extractArtifacts(state) {
  const content = state.rawContent || '';
  const prdMissing = /path:\s*"[^"]*prd\.md"[\s\S]{0,120}exists:\s*false/.test(content);
  const techMissing = /path:\s*"[^"]*tech-design\.md"[\s\S]{0,120}exists:\s*false/.test(content);
  const stateMissing = /path:\s*"[^"]*execution-state\.md"[\s\S]{0,120}exists:\s*false/.test(content);

  return {
    allExist: !prdMissing && !techMissing && !stateMissing,
    prd: !prdMissing,
    tech_design: !techMissing,
    execution_state: !stateMissing
  };
}

/**
 * 运行单个模拟测试
 */
function runSimulation(simId) {
  const fixtureDir = path.join(FIXTURES_DIR, simId);
  const statePath = path.join(fixtureDir, 'execution-state.md');
  const expectedPath = path.join(fixtureDir, 'expected-output.yaml');

  if (!fs.existsSync(statePath) || !fs.existsSync(expectedPath)) {
    return {
      simId,
      status: 'skip',
      errors: ['Fixture 文件不完整']
    };
  }

  const stateContent = fs.readFileSync(statePath, 'utf-8');
  const expectedContent = fs.readFileSync(expectedPath, 'utf-8');

  const state = parseExecutionState(stateContent);
  const expected = parseExpectedOutput(expectedContent);

  // 根据 simulation_id 选择对应的模拟函数
  let result;
  switch (simId) {
    case 'sim-01-resume-stage03':
      result = simulateSIM01(state, expected);
      break;
    case 'sim-02-missing-prd':
      result = simulateSIM02(state, expected);
      break;
    case 'sim-03-autofix-max':
      result = simulateSIM03(state, expected);
      break;
    case 'sim-04-model-missing':
      result = simulateSIM04(state, expected);
      break;
    case 'sim-05-reconcile-warn':
      result = simulateSIM05(state, expected);
      break;
    case 'sim-06-prd-invalid-structure':
      result = simulateSIM06(fixtureDir, expected);
      break;
    case 'sim-07-prd-ascii-art':
      result = simulateSIM07(fixtureDir, expected);
      break;
    case 'sim-08-prd-missing-metadata':
      result = simulateSIM08(fixtureDir, expected);
      break;
    case 'sim-09-openspec-missing-artifacts':
      result = simulateStage02GateFixture(fixtureDir, expected, 'OpenSpec 已触发');
      break;
    case 'sim-10-model-routing-missing':
      result = simulateExecutionStateGateFixture(fixtureDir, expected, '模型路由');
      break;
    case 'sim-11-feishu-readback-missing':
      result = simulateExecutionStateGateFixture(fixtureDir, expected, '飞书上传地址或回读校验');
      break;
    case 'sim-12-tech-design-template-invalid':
      result = simulateTechDesignFixture(fixtureDir, expected, '技术方案章节不符合模板');
      break;
    case 'sim-13-plugin-fallback-missing':
      result = simulateExecutionStateGateFixture(fixtureDir, expected, 'fallback');
      break;
    default:
      return {
        simId,
        status: 'skip',
        errors: [`未知的模拟场景: ${simId}`]
      };
  }

  return {
    simId,
    status: result.matches ? 'pass' : 'fail',
    expected: expected.expected_output,
    actual: result.actual,
    matches: result.matches,
    errors: result.matches ? [] : [`预期行为与实际不符`]
  };
}

/**
 * 生成 Markdown 报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const status = failCount === 0 ? 'PASS' : 'FAIL';

  let md = `# L2 流程模拟测试报告

生成时间: ${timestamp}
测试路径: ${FIXTURES_DIR}

## 汇总

| 指标 | 数值 |
|------|------|
| 总场景 | ${results.length} |
| 通过 | ${passCount} |
| 失败 | ${failCount} |
| 跳过 | ${skipCount} |
| 状态 | ${status} |

## 详细结果

`;

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'skip' ? '⏭️' : '❌';
    md += `### ${icon} ${result.simId}\n\n`;
    md += `**状态:** ${result.status}\n\n`;

    if (result.status === 'fail') {
      md += `**预期输出:**\n`;
      md += '```yaml\n' + yaml.dump(result.expected) + '```\n\n';
      md += `**实际输出:**\n`;
      md += '```yaml\n' + yaml.dump(result.actual) + '```\n\n';
    }

    if (result.errors.length > 0) {
      md += `**错误:** ${result.errors.join(', ')}\n\n`;
    }

    md += '---\n\n';
  }

  md += `*本报告由 run-simulations.js 自动生成*\n`;

  return md;
}

/**
 * 打印彩色结果
 */
function printResults() {
  console.log(`\n${BLUE}${'='.repeat(60)}${RESET}`);
  console.log(`${BLUE}L2 流程模拟测试${RESET}`);
  console.log(`${BLUE}${'='.repeat(60)}${RESET}\n`);

  for (const result of results) {
    if (result.status === 'pass') {
      console.log(`${GREEN}✅ ${result.simId}${RESET} - PASS`);
    } else if (result.status === 'skip') {
      console.log(`${YELLOW}⏭️  ${result.simId}${RESET} - SKIP`);
    } else {
      console.log(`${RED}❌ ${result.simId}${RESET} - FAIL`);
      console.log(`   ${RED}预期: ${JSON.stringify(result.expected)}${RESET}`);
      console.log(`   ${RED}实际: ${JSON.stringify(result.actual)}${RESET}`);
    }
  }

  console.log(`\n${BLUE}${'='.repeat(60)}${RESET}`);
  console.log(`汇总: ${GREEN}${passCount} passed${RESET}, ${RED}${failCount} failed${RESET}, ${YELLOW}${skipCount} skipped${RESET}`);
  console.log(`${BLUE}${'='.repeat(60)}${RESET}\n`);
}

// 主执行流程
async function main() {
  console.log(`\n${BLUE}运行 L2 流程模拟测试...${RESET}\n`);

  // 获取所有模拟场景
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`${RED}错误: Fixtures 目录不存在: ${FIXTURES_DIR}${RESET}`);
    process.exit(1);
  }

  const simDirs = fs.readdirSync(FIXTURES_DIR)
    .filter(f => fs.statSync(path.join(FIXTURES_DIR, f)).isDirectory())
    .filter(name => name.startsWith('sim-'));

  console.log(`找到 ${simDirs.length} 个模拟场景\n`);

  for (const simId of simDirs) {
    const result = runSimulation(simId);
    results.push(result);

    if (result.status === 'pass') {
      passCount++;
    } else if (result.status === 'fail') {
      failCount++;
    } else {
      skipCount++;
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
}

main();
