#!/usr/bin/env node
/**
 * Model Resolver - Resolves model for given stage based on category routing
 * Supports baseline mode when routing is disabled or not configured
 */

const fs = require('fs');
const path = require('path');

// Category definitions and stage mapping
const STAGE_CATEGORY_MAP = {
  '01-knowledge-base': 'quick',
  '02-mrd-clarify': 'writing',
  '02-tech-design': 'deep',
  '03-code-gen': 'deep',
  '03-test-spec': 'quick',
  '03-code-review': 'deep',
  '04-archive': 'writing',
  'default': 'default'
};

class ModelResolver {
  constructor(configPath = './.mrd-to-code-config.json') {
    this.configPath = configPath;
    this.config = this.loadConfig();
    this.workflowDir = './.workflow';
    this.usageLogPath = path.join(this.workflowDir, 'model-usage-log.jsonl');
    this.ensureWorkflowDir();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(content);
      }
    } catch (e) {
      console.error('Error loading config:', e.message);
    }
    return {};
  }

  ensureWorkflowDir() {
    if (!fs.existsSync(this.workflowDir)) {
      fs.mkdirSync(this.workflowDir, { recursive: true });
    }
  }

  isRoutingEnabled() {
    return this.config.model_routing?.enabled === true && 
           this.config.model_routing?.category_models;
  }

  getBaselineModel() {
    return this.config.model_routing?.baseline_model || 
           process.env.CLAUDE_DEFAULT_MODEL || 
           'claude-sonnet-4';
  }

  getStageCategory(stageId) {
    // Check stage overrides first
    const stageOverride = this.config.model_routing?.stage_overrides?.[stageId];
    if (stageOverride?.category) {
      return stageOverride.category;
    }
    
    // Use default mapping
    return STAGE_CATEGORY_MAP[stageId] || STAGE_CATEGORY_MAP.default;
  }

  resolveModel(stageId, options = {}) {
    const {
      userModelOverride,
      agentModelOverride,
      riskEscalationReason,
      escalateTo
    } = options;

    // Priority 1: User explicit override
    if (userModelOverride) {
      return {
        model: userModelOverride,
        category: null,
        source: 'user_override',
        baselineMode: false
      };
    }

    // Priority 2: Agent specific override
    if (agentModelOverride) {
      return {
        model: agentModelOverride,
        category: null,
        source: 'agent_override',
        baselineMode: false
      };
    }

    // Check if routing is enabled
    if (!this.isRoutingEnabled()) {
      return {
        model: this.getBaselineModel(),
        category: null,
        source: 'baseline',
        baselineMode: true
      };
    }

    const categoryModels = this.config.model_routing.category_models;
    let category = this.getStageCategory(stageId);

    // Apply risk escalation if needed
    if (riskEscalationReason && escalateTo) {
      category = escalateTo;
    }

    // Get model list for category, fallback to default
    const models = categoryModels[category] || categoryModels.default || [this.getBaselineModel()];

    // Return first available model (TODO: add actual model availability check)
    return {
      model: models[0],
      category: category,
      source: 'category_routing',
      baselineMode: false,
      fallbackChain: models.slice(1)
    };
  }

  logUsage(stageId, resolution, metrics = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      stage: stageId,
      category: resolution.category,
      model: resolution.model,
      ...metrics
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(this.usageLogPath, logLine, 'utf8');
  }

  /**
   * Update execution state with model routing info
   */
  updateExecutionState(featureDir, modelInfo, escalationReason = null) {
    const execStatePath = path.join(featureDir, 'execution-state.md');
    if (!fs.existsSync(execStatePath)) {
      return;
    }

    let content = fs.readFileSync(execStatePath, 'utf8');
    const modelRoutingSection = `## 模型路由

model_routing:
  current_stage: "${modelInfo.stage}"
  resolved_category: "${modelInfo.category || 'baseline'}"
  resolved_model: "${modelInfo.model}"
  escalation_reason: ${escalationReason ? `"${escalationReason}"` : 'null'}
  escalation_at: ${escalationReason ? `"${new Date().toISOString()}"` : 'null'}
`;

    // Check if section already exists
    if (content.includes('## 模型路由')) {
      content = content.replace(/## 模型路由[\s\S]*?(?=## |$)/, modelRoutingSection);
    } else {
      content = content.trim() + '\n\n' + modelRoutingSection;
    }

    fs.writeFileSync(execStatePath, content, 'utf8');
  }

  /**
   * Check if should show single model reminder
   */
  shouldShowReminder(stageId) {
    if (this.isRoutingEnabled()) return false;
    const keyStages = ['02-tech-design', '03-code-gen'];
    return keyStages.includes(stageId);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const resolver = new ModelResolver();

  switch (command) {
    case 'resolve':
      const stageId = args[1];
      const options = {};
      
      // Parse optional flags
      for (let i = 2; i < args.length; i++) {
        if (args[i].startsWith('--user-model=')) {
          options.userModelOverride = args[i].split('=')[1];
        } else if (args[i].startsWith('--agent-model=')) {
          options.agentModelOverride = args[i].split('=')[1];
        } else if (args[i].startsWith('--escalation=')) {
          options.riskEscalationReason = args[i].split('=')[1];
          options.escalateTo = resolver.config.model_routing?.risk_escalation?.escalate_to || 'deep';
        }
      }

      const result = resolver.resolveModel(stageId, options);
      console.log(JSON.stringify(result, null, 2));
      break;

    case 'check-baseline':
      console.log(JSON.stringify({
        isBaseline: !resolver.isRoutingEnabled(),
        baselineModel: resolver.getBaselineModel()
      }, null, 2));
      break;

    case 'show-reminder':
      const stage = args[1];
      if (resolver.shouldShowReminder(stage)) {
        console.log('提醒：当前为单模型模式，配置 model_routing 可优化效果和成本');
      }
      break;

    case 'log':
      const logStage = args[1];
      const logModel = args[2];
      const logCategory = args[3] || null;
      const metrics = args[4] ? JSON.parse(args[4]) : {};
      
      resolver.logUsage(logStage, { model: logModel, category: logCategory }, metrics);
      console.log('Usage logged');
      break;

    default:
      console.log(`
Model Resolver CLI

Usage:
  node model-resolver.js resolve <stage-id> [--user-model=<model>] [--agent-model=<model>] [--escalation=<reason>]
  node model-resolver.js check-baseline
  node model-resolver.js show-reminder <stage-id>
  node model-resolver.js log <stage-id> <model> [category] [metrics-json]

Examples:
  node model-resolver.js resolve 02-tech-design
  node model-resolver.js resolve 03-code-gen --escalation=consecutive_failures
`);
  }
}

module.exports = ModelResolver;
