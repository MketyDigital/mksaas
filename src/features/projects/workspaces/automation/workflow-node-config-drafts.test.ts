import { buildWorkflowDefinitionWithNodeConfigDraft } from './workflow-node-config-drafts';

describe('buildWorkflowDefinitionWithNodeConfigDraft', () => {
  it('updates only safe draft metadata while preserving existing config and definition data', () => {
    const definition = buildWorkflowDefinitionWithNodeConfigDraft({
      currentDefinition: {
        metadata: { owner: 'automation-team' },
        nodes: [
          {
            config: { agentId: 'agent_123', prompt: 'Keep this prompt' },
            id: 'agent-1',
            position: { x: 20, y: 30 },
            type: 'agent',
          },
          {
            config: { custom: true },
            id: 'legacy-2',
            type: 'custom-provider',
          },
        ],
      },
      label: ' Follow-up agent ',
      nodeId: 'agent-1',
      notes: ' Draft metadata only ',
    });

    expect(definition).toMatchObject({
      metadata: { owner: 'automation-team' },
      nodes: [
        {
          config: {
            agentId: 'agent_123',
            label: 'Follow-up agent',
            notes: 'Draft metadata only',
            prompt: 'Keep this prompt',
          },
          id: 'agent-1',
          position: { x: 20, y: 30 },
          type: 'agent',
        },
        {
          config: { custom: true },
          id: 'legacy-2',
          type: 'custom-provider',
        },
      ],
    });
  });

  it('removes cleared draft metadata without touching other config keys', () => {
    const definition = buildWorkflowDefinitionWithNodeConfigDraft({
      currentDefinition: {
        nodes: [
          {
            config: { label: 'Old label', method: 'POST', notes: 'Old notes', url: 'https://example.com' },
            id: 'http-1',
            type: 'http',
          },
        ],
      },
      label: '   ',
      nodeId: 'http-1',
      notes: '',
    });

    expect(definition.nodes[0]?.config).toEqual({ method: 'POST', url: 'https://example.com' });
  });

  it('rejects unsupported, missing, and ambiguous nodes', () => {
    expect(() =>
      buildWorkflowDefinitionWithNodeConfigDraft({
        currentDefinition: { nodes: [{ config: {}, id: 'custom-1', type: 'custom-provider' }] },
        label: 'Custom',
        nodeId: 'custom-1',
        notes: '',
      }),
    ).toThrow('Unsupported workflow node type.');

    expect(() =>
      buildWorkflowDefinitionWithNodeConfigDraft({
        currentDefinition: { nodes: [] },
        label: '',
        nodeId: 'missing-1',
        notes: '',
      }),
    ).toThrow('Workflow node not found.');

    expect(() =>
      buildWorkflowDefinitionWithNodeConfigDraft({
        currentDefinition: {
          nodes: [
            { config: {}, id: 'agent-1', type: 'agent' },
            { config: {}, id: 'agent-1', type: 'agent' },
          ],
        },
        label: '',
        nodeId: 'agent-1',
        notes: '',
      }),
    ).toThrow('Workflow node id is ambiguous.');
  });
});
