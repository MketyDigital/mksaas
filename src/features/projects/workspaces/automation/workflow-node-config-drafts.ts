import type { WorkflowDefinition } from '@/shared/db/schema';

import { isSupportedDraftNodeType } from './workflow-node-drafts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOptionalText(value: string) {
  return value.trim();
}

export function buildWorkflowDefinitionWithNodeConfigDraft({
  currentDefinition,
  label,
  nodeId,
  notes,
}: {
  currentDefinition: unknown;
  nodeId: string;
  label: string;
  notes: string;
}): WorkflowDefinition {
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
  const normalizedLabel = normalizeOptionalText(label);
  const normalizedNotes = normalizeOptionalText(notes);

  if (normalizedLabel) {
    nextConfig.label = normalizedLabel;
  } else {
    delete nextConfig.label;
  }

  if (normalizedNotes) {
    nextConfig.notes = normalizedNotes;
  } else {
    delete nextConfig.notes;
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
