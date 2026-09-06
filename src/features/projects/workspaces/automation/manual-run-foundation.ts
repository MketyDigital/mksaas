import { executeInternalWorkflowDefinition } from './internal-execution-kernel';
import type { AutomationWorkflowPreflightResult } from './workflow-preflight';

export function assertManualRunPreflightReady(preflight: AutomationWorkflowPreflightResult) {
  if (!preflight.readyForExecutionFoundation || preflight.errorCount > 0 || preflight.warningCount > 0) {
    throw new Error('Workflow preflight must be fully ready before a manual run can start.');
  }
}

export function buildManualRunInternalOutput({ definition, input, workflowVersion }: { definition: unknown; input: Record<string, unknown>; workflowVersion: string }) {
  const execution = executeInternalWorkflowDefinition({ definition, input });
  return {
    ...execution,
    runtimeDispatch: false,
    workflowVersion,
  };
}
