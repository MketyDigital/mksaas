import { executeAutomationWorkflowDefinition, type AutomationExecutionContext } from './internal-execution-kernel';
import type { AutomationWorkflowPreflightResult } from './workflow-preflight';
import type { AutomationWorkflowRuntimeReadiness } from './workflow-runtime-readiness';

export function assertManualRunPreflightReady(preflight: AutomationWorkflowPreflightResult) {
  if (!preflight.readyForExecutionFoundation || preflight.errorCount > 0 || preflight.warningCount > 0) throw new Error('Workflow preflight must be fully ready before a manual run can start.');
}

export function assertManualRunRuntimeReady(runtimeReadiness: AutomationWorkflowRuntimeReadiness) {
  if (!runtimeReadiness.ready || runtimeReadiness.blockers.length > 0) throw new Error('Workflow runtime readiness must be fully ready before a manual run can start.');
}

export async function buildManualRunExecutionOutput({ context, definition, input, workflowVersion }: { context: AutomationExecutionContext; definition: unknown; input: Record<string, unknown>; workflowVersion: string }) {
  const execution = await executeAutomationWorkflowDefinition({ context, definition, input });
  return { ...execution, workflowVersion };
}
