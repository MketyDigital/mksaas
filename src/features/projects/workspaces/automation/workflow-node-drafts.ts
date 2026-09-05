import type { WorkflowDefinition, WorkflowNode } from '@/shared/db/schema';

const SUPPORTED_DRAFT_NODE_TYPES = ['trigger', 'agent', 'http', 'transform', 'condition'] as const;

export type DraftWorkflowNodeType = (typeof SUPPORTED_DRAFT_NODE_TYPES)[number];

function isSupportedDraftNodeType(value: string): value is DraftWorkflowNodeType {
  return SUPPORTED_DRAFT_NODE_TYPES.includes(value as DraftWorkflowNodeType);
}

function getExistingNodes(definition: unknown): WorkflowNode[] {
  const maybeDefinition = definition as { nodes?: unknown };

  if (!Array.isArray(maybeDefinition?.nodes)) {
    return [];
  }

  return maybeDefinition.nodes.filter((node): node is WorkflowNode => {
    const maybeNode = node as Partial<WorkflowNode>;

    return typeof maybeNode.id === 'string' && typeof maybeNode.type === 'string' && maybeNode.config !== null;
  });
}

function buildDraftNodeId({ nodeType, position }: { nodeType: DraftWorkflowNodeType; position: number }) {
  return `${nodeType}-${position}`;
}

export function buildWorkflowDefinitionWithDraftNode({
  currentDefinition,
  nodeType,
}: {
  currentDefinition: unknown;
  nodeType: string;
}): WorkflowDefinition {
  if (!isSupportedDraftNodeType(nodeType)) {
    throw new Error('Unsupported workflow node type.');
  }

  const nodes = getExistingNodes(currentDefinition);
  const draftNode: WorkflowNode = {
    config: {},
    id: buildDraftNodeId({ nodeType, position: nodes.length + 1 }),
    type: nodeType,
  };

  return {
    nodes: [...nodes, draftNode],
  };
}
