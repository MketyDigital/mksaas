import { assertManualRunPreflightReady, buildManualRunNoopOutput } from './manual-run-foundation';

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

  it('builds a deterministic inspection-only output without runtime dispatch', () => {
    expect(
      buildManualRunNoopOutput({
        definition: {
          metadata: { owner: 'automation-team' },
          nodes: [
            { id: 'trigger-1', type: 'trigger', config: { triggerMode: 'manual' } },
            { id: 'agent-1', type: 'agent', config: { agentId: 'agent-a', prompt: 'Draft prompt' } },
          ],
        },
        workflowVersion: '7',
      }),
    ).toEqual({
      inspectedNodeCount: 2,
      inspectedNodes: [
        { id: 'trigger-1', type: 'trigger' },
        { id: 'agent-1', type: 'agent' },
      ],
      mode: 'safe-noop',
      runtimeDispatch: false,
      workflowVersion: '7',
    });
  });
});
