import type { AutomationWorkflowPreflightResult } from './workflow-preflight';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function assertManualRunPreflightReady(preflight: AutomationWorkflowPreflightResult) {
  if (!preflight.readyForExecutionFoundation || preflight.errorCount > 0 || preflight.warningCount > 0) {
    throw new Error('Workflow preflight must be fully ready before a manual run can start.');
  }
}

export function buildManualRunNoopOutput({ definition, workflowVersion }: { definition: unknown; workflowVersion: string }) {
  const nodes = isRecord(definition) && Array.isArray(definition.nodes) ? definition.nodes : [];

  return {
    inspectedNodeCount: nodes.length,
    inspectedNodes: nodes.map((node, index) => {
      const record = isRecord(node) ? node : {};
      return {
        id: typeof record.id === 'string' && record.id.trim() ? record.id : `node-${index + 1}`,
        type: typeof record.type === 'string' && record.type.trim() ? record.type : 'unknown',
      };
    }),
    mode: 'safe-noop',
    runtimeDispatch: false,
    workflowVersion,
  };
}
