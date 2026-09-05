import { buildWorkflowDefinitionWithNodeConfigDraft } from './workflow-node-config-drafts';

describe('buildWorkflowDefinitionWithNodeConfigDraft', () => {
  it('updates agent drafts while preserving unrelated config and definition data', () => {
    const definition = buildWorkflowDefinitionWithNodeConfigDraft({
      currentDefinition: {
        metadata: { owner: 'automation-team' },
        nodes: [
          {
            config: { custom: 'keep-me', agentId: 'old-agent', prompt: 'Old prompt' },
            id: 'agent-1',
            position: { x: 20, y: 30 },
            type: 'agent',
          },
          { config: { custom: true }, id: 'legacy-2', type: 'custom-provider' },
        ],
      },
      agentId: ' agent_456 ',
      label: ' Follow-up agent ',
      nodeId: 'agent-1',
      notes: ' Internal draft ',
      prompt: ' Draft follow-up prompt ',
    });

    expect(definition).toMatchObject({
      metadata: { owner: 'automation-team' },
      nodes: [
        {
          config: {
            agentId: 'agent_456',
            custom: 'keep-me',
            label: 'Follow-up agent',
            notes: 'Internal draft',
            prompt: 'Draft follow-up prompt',
          },
          id: 'agent-1',
          position: { x: 20, y: 30 },
          type: 'agent',
        },
        { config: { custom: true }, id: 'legacy-2', type: 'custom-provider' },
      ],
    });
  });

  it('normalizes HTTP draft fields without making a request', () => {
    const definition = buildWorkflowDefinitionWithNodeConfigDraft({
      body: ' {"ok": true} ',
      currentDefinition: { nodes: [{ config: { timeout: 5 }, id: 'http-1', type: 'http' }] },
      headers: ' {"Authorization": "draft"} ',
      label: '',
      method: 'post',
      nodeId: 'http-1',
      notes: '',
      url: ' https://example.com/hook ',
    });

    expect(definition.nodes[0]?.config).toEqual({
      body: '{"ok": true}',
      headers: '{"Authorization": "draft"}',
      method: 'POST',
      timeout: 5,
      url: 'https://example.com/hook',
    });
    expect(definition.nodes[0]).not.toHaveProperty('runtime');
    expect(definition).not.toHaveProperty('executionEnabled');
  });

  it('stores trigger, transform, and condition drafts only on matching node types', () => {
    const trigger = buildWorkflowDefinitionWithNodeConfigDraft({
      currentDefinition: { nodes: [{ config: {}, id: 'trigger-1', type: 'trigger' }] },
      label: '',
      nodeId: 'trigger-1',
      notes: '',
      triggerMode: 'webhook',
    });
    expect(trigger.nodes[0]?.config).toEqual({ triggerMode: 'webhook' });

    const transform = buildWorkflowDefinitionWithNodeConfigDraft({
      currentDefinition: { nodes: [{ config: {}, id: 'transform-1', type: 'transform' }] },
      input: '{{steps.agent.output}}',
      label: '',
      mapping: '{"message":"$.text"}',
      nodeId: 'transform-1',
      notes: '',
    });
    expect(transform.nodes[0]?.config).toEqual({ input: '{{steps.agent.output}}', mapping: '{"message":"$.text"}' });

    const condition = buildWorkflowDefinitionWithNodeConfigDraft({
      currentDefinition: { nodes: [{ config: {}, id: 'condition-1', type: 'condition' }] },
      field: 'lead.status',
      label: '',
      nodeId: 'condition-1',
      notes: '',
      operator: 'equals',
      value: 'qualified',
    });
    expect(condition.nodes[0]?.config).toEqual({ field: 'lead.status', operator: 'equals', value: 'qualified' });
  });

  it('rejects invalid typed draft values', () => {
    expect(() =>
      buildWorkflowDefinitionWithNodeConfigDraft({
        currentDefinition: { nodes: [{ config: {}, id: 'http-1', type: 'http' }] },
        label: '', method: 'TRACE', nodeId: 'http-1', notes: '', url: 'https://example.com',
      }),
    ).toThrow('Unsupported HTTP method.');

    expect(() =>
      buildWorkflowDefinitionWithNodeConfigDraft({
        currentDefinition: { nodes: [{ config: {}, id: 'http-1', type: 'http' }] },
        label: '', method: 'GET', nodeId: 'http-1', notes: '', url: 'file:///tmp/test',
      }),
    ).toThrow('HTTP URL must use http or https.');

    expect(() =>
      buildWorkflowDefinitionWithNodeConfigDraft({
        currentDefinition: { nodes: [{ config: {}, id: 'trigger-1', type: 'trigger' }] },
        label: '', nodeId: 'trigger-1', notes: '', triggerMode: 'active-now',
      }),
    ).toThrow('Unsupported trigger mode.');

    expect(() =>
      buildWorkflowDefinitionWithNodeConfigDraft({
        currentDefinition: { nodes: [{ config: {}, id: 'condition-1', type: 'condition' }] },
        label: '', nodeId: 'condition-1', notes: '', operator: 'execute',
      }),
    ).toThrow('Unsupported condition operator.');
  });

  it('rejects unsupported, missing, and ambiguous nodes', () => {
    expect(() => buildWorkflowDefinitionWithNodeConfigDraft({
      currentDefinition: { nodes: [{ config: {}, id: 'custom-1', type: 'custom-provider' }] },
      label: 'Custom', nodeId: 'custom-1', notes: '',
    })).toThrow('Unsupported workflow node type.');

    expect(() => buildWorkflowDefinitionWithNodeConfigDraft({
      currentDefinition: { nodes: [] }, label: '', nodeId: 'missing-1', notes: '',
    })).toThrow('Workflow node not found.');

    expect(() => buildWorkflowDefinitionWithNodeConfigDraft({
      currentDefinition: { nodes: [{ config: {}, id: 'agent-1', type: 'agent' }, { config: {}, id: 'agent-1', type: 'agent' }] },
      label: '', nodeId: 'agent-1', notes: '',
    })).toThrow('Workflow node id is ambiguous.');
  });
});
