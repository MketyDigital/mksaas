import { assertManualRunPreflightReady, assertManualRunRuntimeReady, buildManualRunExecutionOutput } from './manual-run-foundation';

const readyPreflight = { checks: [], errorCount: 0, warningCount: 0, readyCount: 1, readyForExecutionFoundation: true };
const readyRuntime = { ready: true, blockers: [] };
const context = { tenantId: 'tenant-1', projectId: 'project-1', workflowId: 'workflow-1', triggerType: 'manual' as const };

describe('manual run foundation', () => {
  it('requires clean static preflight and runtime readiness', () => {
    expect(() => assertManualRunPreflightReady(readyPreflight)).not.toThrow();
    expect(() => assertManualRunRuntimeReady(readyRuntime)).not.toThrow();
    expect(() => assertManualRunRuntimeReady({ ready: false, blockers: [{ code: 'agent.runtime-disabled', message: 'blocked' }] })).toThrow('Workflow runtime readiness must be fully ready before a manual run can start.');
  });

  it('builds execution output inside the existing manual run envelope', async () => {
    await expect(buildManualRunExecutionOutput({ context, definition: { nodes: [
      { id: 'trigger-1', type: 'trigger', config: { triggerMode: 'manual' } },
      { id: 'transform-1', type: 'transform', config: { input: '', mapping: '{"prepared":true}' } },
    ] }, input: {}, workflowVersion: '7' })).resolves.toEqual(expect.objectContaining({ data: { prepared: true }, mode: 'workflow-execution', workflowVersion: '7' }));
  });
});
