import { buildWorkflowDefinitionWithDraftNode } from './workflow-node-drafts';

describe('buildWorkflowDefinitionWithDraftNode', () => {
  it('appends a supported draft node without runtime fields', () => {
    const definition = buildWorkflowDefinitionWithDraftNode({
      currentDefinition: {
        nodes: [
          {
            config: { source: 'manual' },
            id: 'trigger-1',
            type: 'trigger',
          },
        ],
      },
      nodeType: 'agent',
    });

    expect(definition.nodes).toHaveLength(2);
    expect(definition.nodes[1]).toEqual({
      config: {},
      id: 'agent-2',
      type: 'agent',
    });
    expect(definition).not.toHaveProperty('executionEnabled');
    expect(definition).not.toHaveProperty('status');
    expect(definition.nodes[1]).not.toHaveProperty('runtime');
    expect(definition.nodes[1]).not.toHaveProperty('credentials');
  });

  it('preserves unknown nodes, extra node metadata, and definition metadata while appending', () => {
    const definition = buildWorkflowDefinitionWithDraftNode({
      currentDefinition: {
        metadata: { owner: 'automation-team' },
        nodes: [
          {
            config: { custom: true },
            id: 'legacy-1',
            position: { x: 10, y: 20 },
            type: 'custom-provider',
          },
          {
            config: { prompt: 'Keep me' },
            id: 'agent-2',
            type: 'agent',
            version: 3,
          },
        ],
      },
      nodeType: 'http',
    });

    expect(definition).toMatchObject({
      metadata: { owner: 'automation-team' },
      nodes: [
        {
          config: { custom: true },
          id: 'legacy-1',
          position: { x: 10, y: 20 },
          type: 'custom-provider',
        },
        {
          config: { prompt: 'Keep me' },
          id: 'agent-2',
          type: 'agent',
          version: 3,
        },
        {
          config: {},
          id: 'http-3',
          type: 'http',
        },
      ],
    });
  });

  it('generates a non-colliding placeholder id', () => {
    const definition = buildWorkflowDefinitionWithDraftNode({
      currentDefinition: {
        nodes: [
          { config: {}, id: 'trigger-1', type: 'trigger' },
          { config: {}, id: 'agent-3', type: 'agent' },
        ],
      },
      nodeType: 'agent',
    });

    expect(definition.nodes[2]).toMatchObject({ id: 'agent-4', type: 'agent' });
  });

  it('normalizes malformed node collections while preserving other definition metadata', () => {
    const definition = buildWorkflowDefinitionWithDraftNode({
      currentDefinition: { metadata: { source: 'draft' }, nodes: 'bad' },
      nodeType: 'http',
    });

    expect(definition).toMatchObject({
      metadata: { source: 'draft' },
      nodes: [
        {
          config: {},
          id: 'http-1',
          type: 'http',
        },
      ],
    });
  });

  it('rejects unsupported node types', () => {
    expect(() =>
      buildWorkflowDefinitionWithDraftNode({
        currentDefinition: { nodes: [] },
        nodeType: 'payment',
      }),
    ).toThrow('Unsupported workflow node type.');
  });
});
