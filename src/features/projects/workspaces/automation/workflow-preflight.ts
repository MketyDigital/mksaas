const SUPPORTED_NODE_TYPES = new Set(['trigger', 'agent', 'http', 'transform', 'condition']);
const TRIGGER_MODES = new Set(['manual', 'webhook', 'schedule']);
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const CONDITION_OPERATORS = new Set(['equals', 'not_equals', 'contains', 'greater_than', 'less_than']);

export type AutomationWorkflowPreflightSeverity = 'error' | 'warning' | 'ready';

export type AutomationWorkflowPreflightCheck = {
  code: string;
  message: string;
  severity: AutomationWorkflowPreflightSeverity;
  nodeId?: string;
};

export type AutomationWorkflowPreflightResult = {
  checks: AutomationWorkflowPreflightCheck[];
  errorCount: number;
  warningCount: number;
  readyCount: number;
  readyForExecutionFoundation: boolean;
};

export type AutomationWorkflowPreflightOptions = {
  triggerType?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'string' ? record[key].trim() : '';
}

function isHttpUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateAutomationWorkflowDefinition(definition: unknown, options: AutomationWorkflowPreflightOptions = {}): AutomationWorkflowPreflightResult {
  const checks: AutomationWorkflowPreflightCheck[] = [];
  const nodes = isRecord(definition) && Array.isArray(definition.nodes) ? definition.nodes : [];
  const authoritativeTriggerType = options.triggerType?.trim();

  const add = (severity: AutomationWorkflowPreflightSeverity, code: string, message: string, nodeId?: string) => {
    checks.push({ code, message, severity, ...(nodeId ? { nodeId } : {}) });
  };

  if (!nodes.length) {
    add('error', 'workflow.empty', 'Workflow must contain at least one node.');
  } else {
    add('ready', 'workflow.nodes-present', `Workflow contains ${nodes.length} ${nodes.length === 1 ? 'node' : 'nodes'}.`);
  }

  const idCounts = new Map<string, number>();
  let triggerCount = 0;

  nodes.forEach((rawNode, index) => {
    if (!isRecord(rawNode)) {
      add('warning', 'node.malformed', `Node ${index + 1} is malformed and remains inspection-only.`);
      return;
    }

    const nodeId = readString(rawNode, 'id');
    const nodeType = readString(rawNode, 'type');
    const displayId = nodeId || `node-${index + 1}`;

    if (!nodeId) {
      add('error', 'node.id-missing', `Node ${index + 1} requires a stable ID.`);
    } else {
      idCounts.set(nodeId, (idCounts.get(nodeId) || 0) + 1);
    }

    if (!SUPPORTED_NODE_TYPES.has(nodeType)) {
      add('warning', 'node.unsupported', `${nodeType || 'Unknown'} node is inspection-only until its type is supported.`, displayId);
      return;
    }

    const config = isRecord(rawNode.config) ? rawNode.config : {};

    if (nodeType === 'trigger') {
      triggerCount += 1;
      const mode = readString(config, 'triggerMode');
      if (TRIGGER_MODES.has(mode)) add('ready', 'trigger.configured', `Trigger mode ${mode} is structurally prepared.`, displayId);
      else add('error', 'trigger.mode-missing', 'Trigger requires a supported draft mode.', displayId);
      if (authoritativeTriggerType && TRIGGER_MODES.has(mode) && mode !== authoritativeTriggerType) {
        add('error', 'trigger.mode-mismatch', `Trigger node mode ${mode} must match workflow trigger type ${authoritativeTriggerType}.`, displayId);
      }
    }

    if (nodeType === 'agent') {
      const agentId = readString(config, 'agentId');
      const prompt = readString(config, 'prompt');
      if (agentId) add('ready', 'agent.reference-present', 'Agent reference is present; external resolution is intentionally deferred.', displayId);
      else add('error', 'agent.reference-missing', 'Agent node requires an agent reference.', displayId);
      if (prompt) add('ready', 'agent.prompt-present', 'Agent prompt draft is present.', displayId);
      else add('error', 'agent.prompt-missing', 'Agent node requires a prompt draft.', displayId);
    }

    if (nodeType === 'http') {
      const method = readString(config, 'method').toUpperCase();
      const url = readString(config, 'url');
      if (HTTP_METHODS.has(method)) add('ready', 'http.method-valid', `HTTP method ${method} is supported.`, displayId);
      else add('error', 'http.method-invalid', 'HTTP node requires a supported method.', displayId);
      if (isHttpUrl(url)) add('ready', 'http.url-valid', 'HTTP URL is structurally valid.', displayId);
      else add('error', 'http.url-invalid', 'HTTP node requires a valid http or https URL.', displayId);
    }

    if (nodeType === 'transform') {
      const input = readString(config, 'input');
      const mapping = readString(config, 'mapping');
      if (input) add('ready', 'transform.input-present', 'Transform input draft is present.', displayId);
      else add('error', 'transform.input-missing', 'Transform node requires an input draft.', displayId);
      if (mapping) add('ready', 'transform.mapping-present', 'Transform mapping draft is present.', displayId);
      else add('error', 'transform.mapping-missing', 'Transform node requires a mapping draft.', displayId);
    }

    if (nodeType === 'condition') {
      const field = readString(config, 'field');
      const operator = readString(config, 'operator');
      const value = readString(config, 'value');
      if (field) add('ready', 'condition.field-present', 'Condition field is present.', displayId);
      else add('error', 'condition.field-missing', 'Condition node requires a field.', displayId);
      if (CONDITION_OPERATORS.has(operator)) add('ready', 'condition.operator-valid', `Condition operator ${operator} is supported.`, displayId);
      else add('error', 'condition.operator-invalid', 'Condition node requires a supported operator.', displayId);
      if (value) add('ready', 'condition.value-present', 'Condition comparison value is present.', displayId);
      else add('error', 'condition.value-missing', 'Condition node requires a comparison value.', displayId);
    }
  });

  for (const [nodeId, count] of idCounts) {
    if (count > 1) add('error', 'node.id-duplicate', `Node ID ${nodeId} is used ${count} times.`, nodeId);
  }

  if (triggerCount === 0) add('error', 'workflow.trigger-missing', 'Workflow requires one trigger node.');
  else if (triggerCount > 1) add('warning', 'workflow.trigger-multiple', `Workflow contains ${triggerCount} trigger nodes; execution intent is ambiguous.`);
  else add('ready', 'workflow.trigger-ready', 'Workflow contains one trigger node.');

  const errorCount = checks.filter((check) => check.severity === 'error').length;
  const warningCount = checks.filter((check) => check.severity === 'warning').length;
  const readyCount = checks.filter((check) => check.severity === 'ready').length;

  return {
    checks,
    errorCount,
    warningCount,
    readyCount,
    readyForExecutionFoundation: errorCount === 0 && warningCount === 0,
  };
}
