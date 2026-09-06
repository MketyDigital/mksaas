import { assertManualRunDependencyReady, assertManualRunPreflightReady, assertManualRunRuntimeReady, buildManualRunExecutionOutput } from './manual-run-foundation';

const readyPreflight = { checks: [], errorCount: 0, warningCount: 0, readyCount: 1, readyForExecutionFoundation: true };
const readyRuntime = { ready: true, blockers: [] };
const readyDependencies = { ready: true, blockers: [], agents: {} };
const context = { tenantId: 'tenant-1', projectId: 'project-1', workflowId: 'workflow-1', triggerType: 'manual' as const };

describe('manual run foundation', () => {
  it('requires clean static, runtime, and dependency readiness', () => {
    expect(() => assertManualRunPreflightReady(readyPreflight)).not.toThrow();
    expect(() => assertManualRunRuntimeReady(readyRuntime)).not.toThrow();
    expect(() => assertManualRunDependencyReady(readyDependencies)).not.toThrow();
    expect(() => assertManualRunDependencyReady({ ready: false, blockers: [{ code: 'agent.dependency-not-found', message: 'missing' }], agents: {} })).toThrow('Workflow dependencies must be fully ready before a manual run can start.');
  });

  it('passes resolved dependencies into the execution envelope', async () => {
    await expect(buildManualRunExecutionOutput({ context, dependencies: readyDependencies, definition: { nodes: [{ id: 'trigger-1', type: 'trigger', config: {} }, { id: 'transform-1', type: 'transform', config: { input: '', mapping: '{"prepared":true}' } }] }, input: {}, workflowVersion: '7' })).resolves.toEqual(expect.objectContaining({ data: { prepared: true }, mode: 'workflow-execution', workflowVersion: '7' }));
  });
});
