import type { AutomationWorkflowDependencyReadiness } from './agent-dependency-readiness';
import { type AutomationExecutionContext, executeAutomationWorkflowDefinition } from './internal-execution-kernel';
import type { AutomationWorkflowPreflightResult } from './workflow-preflight';
import type { AutomationWorkflowRuntimeReadiness } from './workflow-runtime-readiness';

export function assertManualRunPreflightReady(preflight: AutomationWorkflowPreflightResult) { if (!preflight.readyForExecutionFoundation || preflight.errorCount > 0 || preflight.warningCount > 0) throw new Error('Workflow preflight must be fully ready before a manual run can start.'); }
export function assertManualRunRuntimeReady(runtimeReadiness: AutomationWorkflowRuntimeReadiness) { if (!runtimeReadiness.ready || runtimeReadiness.blockers.length > 0) throw new Error('Workflow runtime readiness must be fully ready before a manual run can start.'); }
export function assertManualRunDependencyReady(readiness: AutomationWorkflowDependencyReadiness) { if (!readiness.ready || readiness.blockers.length > 0) throw new Error('Workflow dependencies must be fully ready before a manual run can start.'); }

export async function buildManualRunExecutionOutput({ context, definition, dependencies, input, workflowVersion }: { context: AutomationExecutionContext; definition: unknown; dependencies: AutomationWorkflowDependencyReadiness; input: Record<string, unknown>; workflowVersion: string }) {
  const execution = await executeAutomationWorkflowDefinition({ context, definition, dependencies: { agents: dependencies.agents }, input });
  return { ...execution, workflowVersion };
}
