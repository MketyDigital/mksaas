import { buildAutomationWorkspaceMetrics } from './automation-model';

describe('buildAutomationWorkspaceMetrics', () => {
  it('counts workflows by status and run outcomes without enabling execution', () => {
    const metrics = buildAutomationWorkspaceMetrics({
      workflows: [
        { status: 'draft', triggerType: 'manual' },
        { status: 'draft', triggerType: 'webhook' },
        { status: 'active', triggerType: 'schedule' },
      ],
      runs: [
        { status: 'completed' },
        { status: 'failed' },
        { status: 'running' },
      ],
    });

    expect(metrics.workflowCount).toBe(3);
    expect(metrics.draftWorkflowCount).toBe(2);
    expect(metrics.activeWorkflowCount).toBe(1);
    expect(metrics.webhookWorkflowCount).toBe(1);
    expect(metrics.runCount).toBe(3);
    expect(metrics.failedRunCount).toBe(1);
    expect(metrics.executionEnabled).toBe(false);
  });

  it('returns zeroed metrics for a new project', () => {
    const metrics = buildAutomationWorkspaceMetrics({ workflows: [], runs: [] });

    expect(metrics.workflowCount).toBe(0);
    expect(metrics.draftWorkflowCount).toBe(0);
    expect(metrics.activeWorkflowCount).toBe(0);
    expect(metrics.webhookWorkflowCount).toBe(0);
    expect(metrics.runCount).toBe(0);
    expect(metrics.failedRunCount).toBe(0);
    expect(metrics.executionEnabled).toBe(false);
  });
});
