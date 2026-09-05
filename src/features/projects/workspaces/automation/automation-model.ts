export type AutomationWorkflowModelInput = {
  status: string;
  triggerType: string;
};

export type AutomationRunModelInput = {
  status: string;
};

export type AutomationWorkspaceMetrics = {
  workflowCount: number;
  draftWorkflowCount: number;
  activeWorkflowCount: number;
  webhookWorkflowCount: number;
  runCount: number;
  failedRunCount: number;
  executionEnabled: false;
};

export function buildAutomationWorkspaceMetrics({
  runs,
  workflows,
}: {
  workflows: AutomationWorkflowModelInput[];
  runs: AutomationRunModelInput[];
}): AutomationWorkspaceMetrics {
  return {
    workflowCount: workflows.length,
    draftWorkflowCount: workflows.filter((workflow) => workflow.status === 'draft').length,
    activeWorkflowCount: workflows.filter((workflow) => workflow.status === 'active').length,
    webhookWorkflowCount: workflows.filter((workflow) => workflow.triggerType === 'webhook').length,
    runCount: runs.length,
    failedRunCount: runs.filter((run) => run.status === 'failed').length,
    executionEnabled: false,
  };
}
