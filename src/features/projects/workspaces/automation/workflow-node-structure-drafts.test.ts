import { buildWorkflowDefinitionWithNodeStructureDraft } from './workflow-node-structure-drafts';

describe('buildWorkflowDefinitionWithNodeStructureDraft', () => {
  const definition = {
    metadata: { owner: 'automation-team' },
    nodes: [
      { config: { source: 'manual' }, id: 'trigger-1', position: { x: 1 }, type: 'trigger' },
      { config: { legacy: true }, id: 'legacy-1', extra: 'preserve', type: 'custom-provider' },
      { config: { agentId: 'agent-1', prompt: 'Draft' }, id: 'agent-1', position: { x: 3 }, type: 'agent' },
    ],
  };

  it('moves a supported node across an unknown node without rewriting either node', () => {
    const result = buildWorkflowDefinitionWithNodeStructureDraft({ currentDefinition: definition, nodeId: 'agent-1', operation: 'move-up' });
    expect(result.nodes.map((node) => node.id)).toEqual(['trigger-1', 'agent-1', 'legacy-1']);
    expect(result.nodes[2]).toEqual(definition.nodes[1]);
    expect(result).toMatchObject({ metadata: { owner: 'automation-team' } });
  });

  it('duplicates the full supported node with a collision-safe id', () => {
    const result = buildWorkflowDefinitionWithNodeStructureDraft({
      currentDefinition: { ...definition, nodes: [...definition.nodes, { config: {}, id: 'agent-1-copy', type: 'agent' }] },
      nodeId: 'agent-1',
      operation: 'duplicate',
    });
    expect(result.nodes[3]).toEqual({ config: { agentId: 'agent-1', prompt: 'Draft' }, id: 'agent-1-copy-2', position: { x: 3 }, type: 'agent' });
  });

  it('deletes exactly the targeted supported node', () => {
    const result = buildWorkflowDefinitionWithNodeStructureDraft({ currentDefinition: definition, nodeId: 'trigger-1', operation: 'delete' });
    expect(result.nodes.map((node) => node.id)).toEqual(['legacy-1', 'agent-1']);
    expect(result.nodes[0]).toEqual(definition.nodes[1]);
  });

  it('rejects unsupported, missing, ambiguous, and impossible boundary operations', () => {
    expect(() => buildWorkflowDefinitionWithNodeStructureDraft({ currentDefinition: definition, nodeId: 'legacy-1', operation: 'delete' })).toThrow('Unsupported workflow node type.');
    expect(() => buildWorkflowDefinitionWithNodeStructureDraft({ currentDefinition: definition, nodeId: 'missing', operation: 'delete' })).toThrow('Workflow node not found.');
    expect(() => buildWorkflowDefinitionWithNodeStructureDraft({ currentDefinition: { nodes: [{ id: 'agent-1', type: 'agent', config: {} }, { id: 'agent-1', type: 'agent', config: {} }] }, nodeId: 'agent-1', operation: 'delete' })).toThrow('Workflow node id is ambiguous.');
    expect(() => buildWorkflowDefinitionWithNodeStructureDraft({ currentDefinition: definition, nodeId: 'trigger-1', operation: 'move-up' })).toThrow('Workflow node is already first.');
    expect(() => buildWorkflowDefinitionWithNodeStructureDraft({ currentDefinition: definition, nodeId: 'agent-1', operation: 'move-down' })).toThrow('Workflow node is already last.');
  });
});
