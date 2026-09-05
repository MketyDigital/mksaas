import type { WorkflowDefinition } from '@/shared/db/schema';

import { isSupportedDraftNodeType } from './workflow-node-drafts';

export type WorkflowNodeStructureDraftOperation = 'move-up' | 'move-down' | 'duplicate' | 'delete';

type RawNode = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getTargetNode(nodes: unknown[], nodeId: string) {
  const matches = nodes
    .map((node, index) => ({ index, node }))
    .filter(({ node }) => isRecord(node) && node.id === nodeId);

  if (matches.length !== 1) {
    throw new Error(matches.length > 1 ? 'Workflow node id is ambiguous.' : 'Workflow node not found.');
  }

  const target = matches[0];
  const node = target.node as RawNode;

  if (typeof node.type !== 'string' || !isSupportedDraftNodeType(node.type)) {
    throw new Error('Unsupported workflow node type.');
  }

  return { index: target.index, node };
}

function buildDuplicateId(nodes: unknown[], nodeId: string) {
  const ids = new Set(
    nodes
      .filter(isRecord)
      .map((node) => node.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );

  const base = `${nodeId}-copy`;
  if (!ids.has(base)) return base;

  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function buildWorkflowDefinitionWithNodeStructureDraft({
  currentDefinition,
  nodeId,
  operation,
}: {
  currentDefinition: unknown;
  nodeId: string;
  operation: WorkflowNodeStructureDraftOperation;
}): WorkflowDefinition {
  if (!nodeId.trim()) throw new Error('Workflow node id is required.');
  if (!isRecord(currentDefinition) || !Array.isArray(currentDefinition.nodes)) {
    throw new Error('Workflow definition does not contain editable nodes.');
  }

  const nodes = [...currentDefinition.nodes];
  const target = getTargetNode(nodes, nodeId);

  if (operation === 'move-up') {
    if (target.index === 0) throw new Error('Workflow node is already first.');
    [nodes[target.index - 1], nodes[target.index]] = [nodes[target.index], nodes[target.index - 1]];
  } else if (operation === 'move-down') {
    if (target.index === nodes.length - 1) throw new Error('Workflow node is already last.');
    [nodes[target.index], nodes[target.index + 1]] = [nodes[target.index + 1], nodes[target.index]];
  } else if (operation === 'duplicate') {
    const duplicateId = buildDuplicateId(nodes, nodeId);
    const duplicate = {
      ...target.node,
      config: isRecord(target.node.config) ? { ...target.node.config } : target.node.config,
      id: duplicateId,
    };
    nodes.splice(target.index + 1, 0, duplicate);
  } else if (operation === 'delete') {
    nodes.splice(target.index, 1);
  } else {
    throw new Error('Unsupported workflow node structure operation.');
  }

  return { ...currentDefinition, nodes } as unknown as WorkflowDefinition;
}
