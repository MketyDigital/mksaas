import { assertManualRunPreflightReady, buildManualRunInternalOutput } from './manual-run-foundation';

const readyPreflight = {
  checks: [{ code: 'workflow.trigger-ready', message: 'Ready', severity: 'ready' as const }],
  errorCount: 0,
  warningCount: 0,
  readyCount: 1,
  readyForExecutionFoundation: true,
};

describe('manual run foundation', () => {
  it('accepts only a clean preflight result', () => {
    expect(() => assertManualRunPreflightReady(readyPreflight)).not.toThrow();
    expect(() => assertManualRunPreflightReady({ ...readyPreflight, warningCount: 1, readyForExecutionFoundation: false })).toThrow(
      'Workflow preflight must be fully ready before a manual run can start.',
    );
    expect(() => assertManualRunPreflightReady({ ...readyPreflight, errorCount: 1, readyForExecutionFoundation: false })).toThrow(
      'Workflow preflight must be fully ready before a manual run can start.',
    );
  });

  it('builds internal execution output inside the existing manual run envelope', () => {
    expect(buildManualRunInternalOutput({
      definition: {
        nodes: [
          { id: 'trigger-1', type: 'trigger', config: { triggerMode: 'manual' } },
          { id: 'transform-1', type: 'transform', config: { input: '', mapping: '{"prepared":true}' } },
        ],
      },
      input: {},
      workflowVersion: '7',
    })).toEqual(expect.objectContaining({
      data: { prepared: true },
      mode: 'internal-execution',
      runtimeDispatch: false,
      workflowVersion: '7',
      steps: [
        expect.objectContaining({ nodeId: 'trigger-1', status: 'completed' }),
        expect.objectContaining({ nodeId: 'transform-1', status: 'completed' }),
      ],
    }));
  });
});
