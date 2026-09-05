import { buildWorkflowNodeSummaries } from './workflow-nodes';

describe('buildWorkflowNodeSummaries', () => {
  it('exposes generic and whitelisted typed draft values without leaking arbitrary config', () => {
    const nodes = buildWorkflowNodeSummaries({
      nodes: [
        { id: 'manual-trigger', type: 'trigger', config: { label: 'Manual start', source: 'manual', triggerMode: 'manual' } },
        { id: 'agent-step', type: 'agent', config: { agentId: 'agent_123', notes: 'Draft note', prompt: 'Follow up', secretToken: 'hidden' } },
      ],
    });

    expect(nodes[0]).toMatchObject({
      canConfigure: true,
      configDraft: { label: 'Manual start', notes: '' },
      id: 'manual-trigger',
      isSupported: true,
      type: 'trigger',
      typeConfigDraft: { triggerMode: 'manual' },
    });
    expect(nodes[1]).toMatchObject({
      canConfigure: true,
      configDraft: { label: '', notes: 'Draft note' },
      id: 'agent-step',
      isSupported: true,
      type: 'agent',
      typeConfigDraft: { agentId: 'agent_123', prompt: 'Follow up' },
    });
    expect(nodes[1]?.typeConfigDraft).not.toHaveProperty('secretToken');
    expect(nodes[1]).not.toHaveProperty('editable');
    expect(nodes[1]).not.toHaveProperty('executable');
  });

  it('marks malformed and unsupported nodes as inspection-only', () => {
    const nodes = buildWorkflowNodeSummaries({
      nodes: [
        { type: 'custom-provider', config: ['not', 'an', 'object'] },
        { id: '', config: { value: 1 }, type: 'agent' },
      ],
    });

    expect(nodes[0]).toMatchObject({ canConfigure: false, id: 'node-1', isSupported: false, type: 'custom-provider' });
    expect(nodes[1]).toMatchObject({ canConfigure: false, id: 'node-2', isSupported: true, type: 'agent' });
  });

  it('returns an empty list for malformed definitions', () => {
    expect(buildWorkflowNodeSummaries(null)).toEqual([]);
    expect(buildWorkflowNodeSummaries({ nodes: 'not-array' })).toEqual([]);
  });
});
