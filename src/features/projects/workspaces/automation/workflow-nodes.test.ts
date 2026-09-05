import { buildWorkflowNodeSummaries } from './workflow-nodes';

describe('buildWorkflowNodeSummaries', () => {
  it('normalizes supported workflow nodes and exposes only safe config draft metadata', () => {
    const nodes = buildWorkflowNodeSummaries({
      nodes: [
        { id: 'manual-trigger', type: 'trigger', config: { label: 'Manual start', source: 'manual' } },
        {
          id: 'agent-step',
          type: 'agent',
          config: { agentId: 'agent_123', notes: 'Draft note', prompt: 'Follow up' },
        },
      ],
    });

    expect(nodes).toEqual([
      {
        canConfigure: true,
        configDraft: { label: 'Manual start', notes: '' },
        configKeys: ['label', 'source'],
        id: 'manual-trigger',
        isSupported: true,
        readinessLabel: 'Prepared',
        type: 'trigger',
      },
      {
        canConfigure: true,
        configDraft: { label: '', notes: 'Draft note' },
        configKeys: ['agentId', 'notes', 'prompt'],
        id: 'agent-step',
        isSupported: true,
        readinessLabel: 'Prepared',
        type: 'agent',
      },
    ]);
    expect(nodes[0]).not.toHaveProperty('editable');
    expect(nodes[0]).not.toHaveProperty('executable');
    expect(nodes[1]?.configDraft).not.toHaveProperty('prompt');
    expect(nodes[1]?.configDraft).not.toHaveProperty('agentId');
  });

  it('marks malformed and unsupported nodes as inspection-only', () => {
    const nodes = buildWorkflowNodeSummaries({
      nodes: [
        { type: 'custom-provider', config: ['not', 'an', 'object'] },
        { id: '', config: { value: 1 }, type: 'agent' },
      ],
    });

    expect(nodes).toEqual([
      {
        canConfigure: false,
        configDraft: { label: '', notes: '' },
        configKeys: [],
        id: 'node-1',
        isSupported: false,
        readinessLabel: 'Needs review',
        type: 'custom-provider',
      },
      {
        canConfigure: false,
        configDraft: { label: '', notes: '' },
        configKeys: ['value'],
        id: 'node-2',
        isSupported: true,
        readinessLabel: 'Prepared',
        type: 'agent',
      },
    ]);
  });

  it('returns an empty list for malformed definitions', () => {
    expect(buildWorkflowNodeSummaries(null)).toEqual([]);
    expect(buildWorkflowNodeSummaries({ nodes: 'not-array' })).toEqual([]);
  });
});
