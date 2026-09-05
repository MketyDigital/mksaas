const SUPPORTED_WORKFLOW_NODE_TYPES = new Set(['trigger', 'agent', 'http', 'transform', 'condition']);

type RawWorkflowNode = {
  id?: unknown;
  type?: unknown;
  config?: unknown;
};

export type WorkflowNodeSummary = {
  id: string;
  type: string;
  configKeys: string[];
  isSupported: boolean;
  readinessLabel: 'Prepared' | 'Needs review';
};

export function buildWorkflowNodeSummaries(definition: unknown): WorkflowNodeSummary[] {
  const maybeDefinition = definition as { nodes?: RawWorkflowNode[] };
  const nodes = Array.isArray(maybeDefinition?.nodes) ? maybeDefinition.nodes : [];

  return nodes.map((node, index) => {
    const type = typeof node.type === 'string' && node.type.length > 0 ? node.type : 'unknown';
    const isSupported = SUPPORTED_WORKFLOW_NODE_TYPES.has(type);
    const config = node.config && typeof node.config === 'object' && !Array.isArray(node.config) ? node.config : {};

    return {
      configKeys: Object.keys(config),
      id: typeof node.id === 'string' && node.id.length > 0 ? node.id : `node-${index + 1}`,
      isSupported,
      readinessLabel: isSupported ? 'Prepared' : 'Needs review',
      type,
    };
  });
}
