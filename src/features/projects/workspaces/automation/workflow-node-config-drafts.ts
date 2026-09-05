import type { WorkflowDefinition } from '@/shared/db/schema';

import { isSupportedDraftNodeType } from './workflow-node-drafts';

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const TRIGGER_MODES = new Set(['manual', 'webhook', 'schedule']);
const CONDITION_OPERATORS = new Set(['equals', 'not_equals', 'contains', 'greater_than', 'less_than']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOptionalText(value: string | undefined, fieldName: string, maxLength: number) {
  const normalized = (value || '').trim();

  if (normalized.length > maxLength) {
    throw new Error(`${fieldName} is too long.`);
  }

  return normalized;
}

function applyOptionalText(config: Record<string, unknown>, key: string, value: string) {
  if (value) {
    config[key] = value;
  } else {
    delete config[key];
  }
}

function validateHttpUrl(value: string) {
  if (!value) {
    return;
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error('HTTP URL must be a valid URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('HTTP URL must use http or https.');
  }
}

export type WorkflowNodeConfigDraftInput = {
  currentDefinition: unknown;
  nodeId: string;
  label: string;
  notes: string;
  triggerMode?: string;
  agentId?: string;
  prompt?: string;
  method?: string;
  url?: string;
  headers?: string;
  body?: string;
  input?: string;
  mapping?: string;
  field?: string;
  operator?: string;
  value?: string;
};

export type WorkflowNodeTypeConfigDraft = {
  triggerMode: string;
  agentId: string;
  prompt: string;
  method: string;
  url: string;
  headers: string;
  body: string;
  input: string;
  mapping: string;
  field: string;
  operator: string;
  value: string;
};

export function buildWorkflowNodeTypeConfigDraft(config: Record<string, unknown>): WorkflowNodeTypeConfigDraft {
  const read = (key: string) => (typeof config[key] === 'string' ? config[key] : '');

  return {
    triggerMode: read('triggerMode'),
    agentId: read('agentId'),
    prompt: read('prompt'),
    method: read('method'),
    url: read('url'),
    headers: read('headers'),
    body: read('body'),
    input: read('input'),
    mapping: read('mapping'),
    field: read('field'),
    operator: read('operator'),
    value: read('value'),
  };
}

export function buildWorkflowDefinitionWithNodeConfigDraft(input: WorkflowNodeConfigDraftInput): WorkflowDefinition {
  const { currentDefinition, nodeId } = input;

  if (!nodeId.trim()) {
    throw new Error('Workflow node id is required.');
  }

  if (!isRecord(currentDefinition) || !Array.isArray(currentDefinition.nodes)) {
    throw new Error('Workflow definition does not contain configurable nodes.');
  }

  const matchingNodes = currentDefinition.nodes.filter((node) => isRecord(node) && node.id === nodeId);

  if (matchingNodes.length !== 1) {
    throw new Error(matchingNodes.length > 1 ? 'Workflow node id is ambiguous.' : 'Workflow node not found.');
  }

  const targetNode = matchingNodes[0];
  const nodeType = targetNode.type;

  if (typeof nodeType !== 'string' || !isSupportedDraftNodeType(nodeType)) {
    throw new Error('Unsupported workflow node type.');
  }

  const config = isRecord(targetNode.config) ? targetNode.config : {};
  const nextConfig: Record<string, unknown> = { ...config };

  applyOptionalText(nextConfig, 'label', normalizeOptionalText(input.label, 'Node label', 120));
  applyOptionalText(nextConfig, 'notes', normalizeOptionalText(input.notes, 'Node notes', 500));

  if (nodeType === 'trigger') {
    const triggerMode = normalizeOptionalText(input.triggerMode, 'Trigger mode', 40);
    if (triggerMode && !TRIGGER_MODES.has(triggerMode)) {
      throw new Error('Unsupported trigger mode.');
    }
    applyOptionalText(nextConfig, 'triggerMode', triggerMode);
  }

  if (nodeType === 'agent') {
    applyOptionalText(nextConfig, 'agentId', normalizeOptionalText(input.agentId, 'Agent id', 160));
    applyOptionalText(nextConfig, 'prompt', normalizeOptionalText(input.prompt, 'Agent prompt', 4000));
  }

  if (nodeType === 'http') {
    const method = normalizeOptionalText(input.method, 'HTTP method', 10).toUpperCase();
    if (method && !HTTP_METHODS.has(method)) {
      throw new Error('Unsupported HTTP method.');
    }

    const url = normalizeOptionalText(input.url, 'HTTP URL', 2048);
    validateHttpUrl(url);

    applyOptionalText(nextConfig, 'method', method);
    applyOptionalText(nextConfig, 'url', url);
    applyOptionalText(nextConfig, 'headers', normalizeOptionalText(input.headers, 'HTTP headers', 4000));
    applyOptionalText(nextConfig, 'body', normalizeOptionalText(input.body, 'HTTP body', 10000));
  }

  if (nodeType === 'transform') {
    applyOptionalText(nextConfig, 'input', normalizeOptionalText(input.input, 'Transform input', 2000));
    applyOptionalText(nextConfig, 'mapping', normalizeOptionalText(input.mapping, 'Transform mapping', 6000));
  }

  if (nodeType === 'condition') {
    const operator = normalizeOptionalText(input.operator, 'Condition operator', 40);
    if (operator && !CONDITION_OPERATORS.has(operator)) {
      throw new Error('Unsupported condition operator.');
    }

    applyOptionalText(nextConfig, 'field', normalizeOptionalText(input.field, 'Condition field', 200));
    applyOptionalText(nextConfig, 'operator', operator);
    applyOptionalText(nextConfig, 'value', normalizeOptionalText(input.value, 'Condition value', 2000));
  }

  return {
    ...currentDefinition,
    nodes: currentDefinition.nodes.map((node) =>
      node === targetNode
        ? {
            ...targetNode,
            config: nextConfig,
          }
        : node,
    ),
  } as unknown as WorkflowDefinition;
}
