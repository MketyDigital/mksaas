import { buildWorkflowNodeSummaries } from './workflow-nodes';

describe('buildWorkflowNodeSummaries', () => {
  it('normalizes supported workflow nodes without enabling editing or execution', () => {
    const nodes = buildWorkflowNodeSummaries({
      nodes: [
        { id: 'manual-trigger', type: 'trigger', config: { source: 'manual' } },
        { id: 'agent-step', type: 'agent', config: { agentId: 'agent_123', prompt: 'Follow up' } },
      ],
    });

    expect(nodes).toEqual([
      {
        configKeys: ['source'],
        id: 'manual-trigger',
        isSupported: true,
        readinessLabel: 'Prepared',
        type: 'trigger',
      },
      {
        configKeys: ['agentId', 'prompt'],
        id: 'agent-step',
        isSupported: true,
        readinessLabel: 'Prepared',
        type: 'agent',
      },
    ]);
    expect(nodes[0]).not.toHaveProperty('editable');
    expect(nodes[0]).not.toHaveProperty('executable');
  });

  it('marks malformed and unsupported nodes as inspection-only', () => {
    const nodes = buildWorkflowNodeSummaries({
      nodes: [
        { type: 'custom-provider', config: ['not', 'an', 'object'] },
        { id: '', config: { value: 1 } },
      ],
    });

    expect(nodes).toEqual([
      {
        configKeys: [],
        id: 'node-1',
        isSupported: false,
        readinessLabel: 'Needs review',
        type: 'custom-provider',
      },
      {
        configKeys: ['value'],
        id: 'node-2',
        isSupported: false,
        readinessLabel: 'Needs review',
        type: 'unknown',
      },
    ]);
  });

  it('returns an empty list for malformed definitions', () => {
    expect(buildWorkflowNodeSummaries(null)).toEqual([]);
    expect(buildWorkflowNodeSummaries({ nodes: 'not-array' })).toEqual([]);
  });
});
