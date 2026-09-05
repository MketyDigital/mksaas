import type { WorkflowDefinition, WorkflowNode } from '@/shared/db/schema';

const SUPPORTED_DRAFT_NODE_TYPES = ['trigger', 'agent', 'http', 'transform', 'condition'] as const;

export type DraftWorkflowNodeType = (typeof SUPPORTED_DRAFT_NODE_TYPES)[number];

export function isSupportedDraftNodeType(value: string): value is DraftWorkflowNodeType {
  return SUPPORTED_DRAFT_NODE_TYPES.includes(value as DraftWorkflowNodeType);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildDraftNodeId({
  existingIds,
  nodeType,
  position,
}: {
  existingIds: Set<string>;
  nodeType: DraftWorkflowNodeType;
  position: number;
}) {
  let nextPosition = position;
  let nodeId = `${nodeType}-${nextPosition}`;

  while (existingIds.has(nodeId)) {
    nextPosition += 1;
    nodeId = `${nodeType}-${nextPosition}`;
  }

  return nodeId;
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

  const definition = isRecord(currentDefinition) ? currentDefinition : {};
  const nodes = Array.isArray(definition.nodes) ? definition.nodes : [];
  const existingIds = new Set(
    nodes
      .filter(isRecord)
      .map((node) => node.id)
      .filter((nodeId): nodeId is string => typeof nodeId === 'string' && nodeId.length > 0),
  );
  const draftNode: WorkflowNode = {
    config: {},
    id: buildDraftNodeId({ existingIds, nodeType, position: nodes.length + 1 }),
    type: nodeType,
  };

  return {
    ...definition,
    nodes: [...nodes, draftNode],
  } as unknown as WorkflowDefinition;
}
