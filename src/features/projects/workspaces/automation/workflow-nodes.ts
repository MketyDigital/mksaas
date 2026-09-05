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
  configDraft: {
    label: string;
    notes: string;
  };
  isSupported: boolean;
  canConfigure: boolean;
  readinessLabel: 'Prepared' | 'Needs review';
};

export function buildWorkflowNodeSummaries(definition: unknown): WorkflowNodeSummary[] {
  const maybeDefinition = definition as { nodes?: RawWorkflowNode[] };
  const nodes = Array.isArray(maybeDefinition?.nodes) ? maybeDefinition.nodes : [];

  return nodes.map((node, index) => {
    const type = typeof node.type === 'string' && node.type.length > 0 ? node.type : 'unknown';
    const isSupported = SUPPORTED_WORKFLOW_NODE_TYPES.has(type);
    const hasStableId = typeof node.id === 'string' && node.id.length > 0;
    const config = node.config && typeof node.config === 'object' && !Array.isArray(node.config) ? node.config : {};
    const label = 'label' in config && typeof config.label === 'string' ? config.label : '';
    const notes = 'notes' in config && typeof config.notes === 'string' ? config.notes : '';

    return {
      canConfigure: isSupported && hasStableId,
      configDraft: { label, notes },
      configKeys: Object.keys(config),
      id: hasStableId ? node.id : `node-${index + 1}`,
      isSupported,
      readinessLabel: isSupported ? 'Prepared' : 'Needs review',
      type,
    };
  });
}
