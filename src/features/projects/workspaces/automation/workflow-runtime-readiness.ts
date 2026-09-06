const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

export type AutomationWorkflowRuntimeReadinessBlocker = {
  code: string;
  message: string;
  nodeId?: string;
};

export type AutomationWorkflowRuntimeReadiness = {
  ready: boolean;
  blockers: AutomationWorkflowRuntimeReadinessBlocker[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'string' ? record[key].trim() : '';
}

export function validateAutomationWorkflowRuntimeReadiness(definition: unknown): AutomationWorkflowRuntimeReadiness {
  const blockers: AutomationWorkflowRuntimeReadinessBlocker[] = [];
  const nodes = isRecord(definition) && Array.isArray(definition.nodes) ? definition.nodes : [];

  nodes.forEach((rawNode, index) => {
    if (!isRecord(rawNode)) {
      blockers.push({ code: 'node.runtime-malformed', message: `Node ${index + 1} is malformed and cannot execute.` });
      return;
    }

    const nodeId = readString(rawNode, 'id') || `node-${index + 1}`;
    const nodeType = readString(rawNode, 'type');
    if (nodeType === 'agent') {
      blockers.push({ code: 'agent.runtime-disabled', message: 'Agent action runtime is not enabled yet.', nodeId });
      return;
    }
    if (!['trigger', 'transform', 'condition', 'http'].includes(nodeType)) {
      blockers.push({ code: 'node.runtime-unsupported', message: `${nodeType || 'Unknown'} node runtime is not supported.`, nodeId });
      return;
    }
    if (nodeType !== 'http') return;

    const config = isRecord(rawNode.config) ? rawNode.config : {};
    const method = readString(config, 'method').toUpperCase();
    const urlValue = readString(config, 'url');
    if (!HTTP_METHODS.has(method)) blockers.push({ code: 'http.runtime-method-unsupported', message: 'HTTP action method is not runtime-supported.', nodeId });

    try {
      const url = new URL(urlValue);
      if (url.protocol !== 'https:') blockers.push({ code: 'http.runtime-https-required', message: 'HTTP action runtime requires an HTTPS URL.', nodeId });
    } catch {
      blockers.push({ code: 'http.runtime-https-required', message: 'HTTP action runtime requires an HTTPS URL.', nodeId });
    }

    const body = readString(config, 'body');
    if (BODY_METHODS.has(method) && body) {
      try {
        JSON.parse(body);
      } catch {
        blockers.push({ code: 'http.runtime-body-invalid', message: 'HTTP action body must be valid JSON before execution.', nodeId });
      }
    }
  });

  return { blockers, ready: blockers.length === 0 };
}
