import type { AutomationWorkflowDependencyReadiness } from './agent-dependency-readiness';
import type { AutomationExecutionResult } from './internal-execution-kernel';

type TriggerType = 'manual' | 'webhook';
type WorkflowRecord = {
  id: string;
  tenantId: string;
  projectId: string;
  triggerType: string;
  definition: unknown;
  version: string;
};

type ExecutionInput = {
  workflow: WorkflowRecord;
  triggerType: TriggerType;
  input: Record<string, unknown>;
  dependencyReadiness: AutomationWorkflowDependencyReadiness;
  onRunCreated?: (runId: string) => Promise<void>;
};

export type AutomationWorkflowExecutionDependencies = {
  insertRun: (input: { tenantId: string; projectId: string; workflowId: string; triggerType: TriggerType; input: Record<string, unknown>; status: 'queued' }) => Promise<{ id: string } | null>;
  updateRun: (runId: string, update: Record<string, unknown>, workflow: WorkflowRecord) => Promise<void>;
  executeDefinition: (input: { context: { tenantId: string; projectId: string; workflowId: string; triggerType: TriggerType }; definition: unknown; dependencies: { agents: AutomationWorkflowDependencyReadiness['agents'] }; input: Record<string, unknown> }) => Promise<AutomationExecutionResult>;
};

export async function executeAutomationWorkflowRun(input: ExecutionInput, dependencies: AutomationWorkflowExecutionDependencies) {
  const { workflow, triggerType, dependencyReadiness } = input;
  if (workflow.triggerType !== triggerType) throw new Error('Workflow trigger type does not allow this execution.');
  if (!dependencyReadiness.ready || dependencyReadiness.blockers.length > 0) throw new Error('Workflow dependencies must be fully ready before execution.');

  const run = await dependencies.insertRun({
    tenantId: workflow.tenantId,
    projectId: workflow.projectId,
    workflowId: workflow.id,
    triggerType,
    input: input.input,
    status: 'queued',
  });
  if (!run) throw new Error('Workflow run could not be created.');

  try {
    if (input.onRunCreated) await input.onRunCreated(run.id);
    await dependencies.updateRun(run.id, { status: 'running' }, workflow);
    const execution = await dependencies.executeDefinition({
      context: { tenantId: workflow.tenantId, projectId: workflow.projectId, workflowId: workflow.id, triggerType },
      definition: workflow.definition,
      dependencies: { agents: dependencyReadiness.agents },
      input: input.input,
    });
    const output = { ...execution, workflowVersion: workflow.version };
    await dependencies.updateRun(run.id, { status: 'completed', output, completedAt: new Date() }, workflow);
    return { runId: run.id, output };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 4096) : 'Workflow execution failed.';
    await dependencies.updateRun(run.id, { status: 'failed', error: message, completedAt: new Date() }, workflow);
    throw error;
  }
}
