import { buildWorkflowNodeTypeConfigDraft, type WorkflowNodeTypeConfigDraft } from './workflow-node-config-drafts';

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
  typeConfigDraft: WorkflowNodeTypeConfigDraft;
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
    const stableId = typeof node.id === 'string' && node.id.length > 0 ? node.id : null;
    const config = node.config && typeof node.config === 'object' && !Array.isArray(node.config) ? node.config as Record<string, unknown> : {};
    const label = typeof config.label === 'string' ? config.label : '';
    const notes = typeof config.notes === 'string' ? config.notes : '';

    return {
      canConfigure: isSupported && stableId !== null,
      configDraft: { label, notes },
      configKeys: Object.keys(config),
      id: stableId ?? `node-${index + 1}`,
      isSupported,
      readinessLabel: isSupported ? 'Prepared' : 'Needs review',
      type,
      typeConfigDraft: buildWorkflowNodeTypeConfigDraft(config),
    };
  });
}
