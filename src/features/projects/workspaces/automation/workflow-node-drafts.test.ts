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

  it('normalizes malformed definitions before appending a safe node', () => {
    const definition = buildWorkflowDefinitionWithDraftNode({
      currentDefinition: { nodes: 'bad' },
      nodeType: 'http',
    });

    expect(definition.nodes).toEqual([
      {
        config: {},
        id: 'http-1',
        type: 'http',
      },
    ]);
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
