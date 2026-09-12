import { validateAutomationWorkflowDefinition } from './workflow-preflight';

describe('validateAutomationWorkflowDefinition', () => {
  it('marks a structurally prepared workflow ready without resolving external resources', () => {
    const result = validateAutomationWorkflowDefinition({
      metadata: { keep: true },
      nodes: [
        { id: 'trigger-1', type: 'trigger', config: { triggerMode: 'manual' } },
        { id: 'agent-1', type: 'agent', config: { agentId: 'agent_external_reference', prompt: 'Draft a reply' } },
        { id: 'http-1', type: 'http', config: { method: 'POST', url: 'https://example.com/hook' } },
        { id: 'transform-1', type: 'transform', config: { input: '{{http.body}}', mapping: '{"email":"{{input.email}}"}' } },
        { id: 'condition-1', type: 'condition', config: { field: 'status', operator: 'equals', value: 'qualified' } },
      ],
    }, { triggerType: 'manual' });

    expect(result.readyForExecutionFoundation).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.readyCount).toBeGreaterThan(0);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'agent.reference-present', nodeId: 'agent-1', severity: 'ready' }),
      expect.objectContaining({ code: 'http.url-valid', nodeId: 'http-1', severity: 'ready' }),
      expect.objectContaining({ code: 'workflow.trigger-ready', severity: 'ready' }),
    ]));
  });

  it.each([
    ['manual', 'manual'],
    ['webhook', 'webhook'],
  ])('accepts matching workflow %s and trigger-node %s modes', (triggerType, triggerMode) => {
    const result = validateAutomationWorkflowDefinition({
      nodes: [{ id: 'trigger-1', type: 'trigger', config: { triggerMode } }],
    }, { triggerType });

    expect(result.checks).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'trigger.mode-mismatch' }),
    ]));
    expect(result.errorCount).toBe(0);
  });

  it.each([
    ['webhook', 'manual'],
    ['manual', 'webhook'],
  ])('rejects workflow %s when the trigger node is configured as %s', (triggerType, triggerMode) => {
    const result = validateAutomationWorkflowDefinition({
      nodes: [{ id: 'trigger-1', type: 'trigger', config: { triggerMode } }],
    }, { triggerType });

    expect(result.readyForExecutionFoundation).toBe(false);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'trigger.mode-mismatch', severity: 'error', nodeId: 'trigger-1' }),
    ]));
  });

  it('reports global identity, trigger, and inspection-only problems without mutating the definition', () => {
    const definition = {
      metadata: { owner: 'automation' },
      nodes: [
        { id: 'agent-1', type: 'agent', config: { agentId: '', prompt: '' } },
        { id: 'agent-1', type: 'custom-provider', config: { untouched: true }, version: 9 },
        { type: 'http', config: { method: 'TRACE', url: 'ftp://example.com' } },
      ],
    };
    const before = JSON.stringify(definition);
    const result = validateAutomationWorkflowDefinition(definition);

    expect(JSON.stringify(definition)).toBe(before);
    expect(result.readyForExecutionFoundation).toBe(false);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'node.id-duplicate', severity: 'error' }),
      expect.objectContaining({ code: 'node.id-missing', severity: 'error' }),
      expect.objectContaining({ code: 'node.unsupported', severity: 'warning' }),
      expect.objectContaining({ code: 'workflow.trigger-missing', severity: 'error' }),
      expect.objectContaining({ code: 'agent.reference-missing', severity: 'error' }),
      expect.objectContaining({ code: 'agent.prompt-missing', severity: 'error' }),
      expect.objectContaining({ code: 'http.method-invalid', severity: 'error' }),
      expect.objectContaining({ code: 'http.url-invalid', severity: 'error' }),
    ]));
  });

  it('reports multiple triggers and incomplete transform and condition drafts', () => {
    const result = validateAutomationWorkflowDefinition({
      nodes: [
        { id: 'trigger-1', type: 'trigger', config: { triggerMode: 'manual' } },
        { id: 'trigger-2', type: 'trigger', config: { triggerMode: 'webhook' } },
        { id: 'transform-1', type: 'transform', config: { input: '', mapping: '' } },
        { id: 'condition-1', type: 'condition', config: { field: '', operator: 'unknown', value: '' } },
      ],
    });

    expect(result.readyForExecutionFoundation).toBe(false);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'workflow.trigger-multiple', severity: 'warning' }),
      expect.objectContaining({ code: 'transform.input-missing', severity: 'error' }),
      expect.objectContaining({ code: 'transform.mapping-missing', severity: 'error' }),
      expect.objectContaining({ code: 'condition.field-missing', severity: 'error' }),
      expect.objectContaining({ code: 'condition.operator-invalid', severity: 'error' }),
      expect.objectContaining({ code: 'condition.value-missing', severity: 'error' }),
    ]));
  });

  it('reports an empty definition as not ready', () => {
    const result = validateAutomationWorkflowDefinition(null);
    expect(result.readyForExecutionFoundation).toBe(false);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'workflow.empty', severity: 'error' }),
      expect.objectContaining({ code: 'workflow.trigger-missing', severity: 'error' }),
    ]));
  });
});
