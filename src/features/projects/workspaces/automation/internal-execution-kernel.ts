type WorkflowData = Record<string, unknown>;

type RawWorkflowNode = {
  id?: unknown;
  type?: unknown;
  config?: unknown;
};

export type AutomationInternalExecutionStep = {
  nodeId: string;
  nodeType: 'trigger' | 'transform' | 'condition';
  status: 'completed' | 'skipped';
  conditionMatched?: boolean;
  resolvedInput?: string;
};

export type AutomationInternalExecutionResult = {
  mode: 'internal-execution';
  data: WorkflowData;
  steps: AutomationInternalExecutionStep[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getPathValue(data: WorkflowData, path: string): unknown {
  if (!path.trim()) return undefined;
  let current: unknown = data;
  for (const part of path.split('.')) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function interpolate(value: string, data: WorkflowData): string {
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path: string) => {
    const resolved = getPathValue(data, path.trim());
    if (resolved == null) return '';
    return typeof resolved === 'string' ? resolved : JSON.stringify(resolved);
  });
}

function interpolateValue(value: unknown, data: WorkflowData): unknown {
  if (typeof value === 'string') return interpolate(value, data);
  if (Array.isArray(value)) return value.map((item) => interpolateValue(item, data));
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolateValue(item, data)]));
}

function parseTransformMapping(value: unknown): WorkflowData {
  if (typeof value !== 'string') throw new Error('Transform mapping must be a valid JSON object.');
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) throw new Error('Transform mapping must be a valid JSON object.');
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message === 'Transform mapping must be a valid JSON object.') throw error;
    throw new Error('Transform mapping must be a valid JSON object.');
  }
}

function evaluateCondition(config: Record<string, unknown>, data: WorkflowData): boolean {
  const field = String(config.field ?? '').trim();
  const operator = String(config.operator ?? '').trim();
  const expected = config.value;
  const actual = getPathValue(data, field);

  if (operator === 'equals') return String(actual ?? '') === String(expected ?? '');
  if (operator === 'not_equals') return String(actual ?? '') !== String(expected ?? '');
  if (operator === 'contains') return String(actual ?? '').includes(String(expected ?? ''));
  if (operator === 'greater_than') return Number(actual) > Number(expected);
  if (operator === 'less_than') return Number(actual) < Number(expected);
  throw new Error('Unsupported condition operator.');
}

export function executeInternalWorkflowDefinition({ definition, input }: { definition: unknown; input: WorkflowData }): AutomationInternalExecutionResult {
  if (!isRecord(definition) || !Array.isArray(definition.nodes)) throw new Error('Workflow definition must contain a nodes array.');

  const nodes = definition.nodes as RawWorkflowNode[];
  for (const node of nodes) {
    const type = typeof node?.type === 'string' ? node.type : 'unknown';
    if (!['trigger', 'transform', 'condition'].includes(type)) {
      throw new Error('External or unsupported workflow action runtime is not enabled.');
    }
  }

  let data: WorkflowData = { ...input };
  const steps: AutomationInternalExecutionStep[] = [];
  let branchOpen = true;

  for (const [index, node] of nodes.entries()) {
    const nodeId = typeof node.id === 'string' && node.id.trim() ? node.id : `node-${index + 1}`;
    const nodeType = node.type as AutomationInternalExecutionStep['nodeType'];
    const config = isRecord(node.config) ? node.config : {};

    if (nodeType !== 'trigger' && !branchOpen) {
      steps.push({ nodeId, nodeType, status: 'skipped' });
      continue;
    }

    if (nodeType === 'trigger') {
      steps.push({ nodeId, nodeType, status: 'completed' });
      continue;
    }

    if (nodeType === 'transform') {
      const mapping = parseTransformMapping(config.mapping);
      const resolvedInput = interpolate(String(config.input ?? ''), data);
      const resolvedMapping = interpolateValue(mapping, data);
      if (!isRecord(resolvedMapping)) throw new Error('Transform mapping must be a valid JSON object.');
      data = { ...data, ...resolvedMapping };
      steps.push({ nodeId, nodeType, status: 'completed', resolvedInput });
      continue;
    }

    const conditionMatched = evaluateCondition(config, data);
    branchOpen = conditionMatched;
    steps.push({ conditionMatched, nodeId, nodeType, status: 'completed' });
  }

  return { data, mode: 'internal-execution', steps };
}
