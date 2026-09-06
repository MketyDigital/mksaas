import { executeInternalWorkflowDefinition } from './internal-execution-kernel';

describe('executeInternalWorkflowDefinition', () => {
  it('executes trigger and transform nodes in order without mutating input', () => {
    const input = { customer: { name: 'Ada' }, score: 10 };
    const before = JSON.parse(JSON.stringify(input));

    const result = executeInternalWorkflowDefinition({
      definition: {
        nodes: [
          { id: 'trigger-1', type: 'trigger', config: { triggerMode: 'manual' } },
          {
            id: 'transform-1',
            type: 'transform',
            config: {
              input: '{{customer.name}}',
              mapping: '{"greeting":"Hello {{customer.name}}","nested":{"score":"{{score}}"}}',
            },
          },
        ],
      },
      input,
    });

    expect(input).toEqual(before);
    expect(result.mode).toBe('internal-execution');
    expect(result.data).toEqual({
      customer: { name: 'Ada' },
      greeting: 'Hello Ada',
      nested: { score: '10' },
      score: 10,
    });
    expect(result.steps.map((step) => [step.nodeId, step.status])).toEqual([
      ['trigger-1', 'completed'],
      ['transform-1', 'completed'],
    ]);
  });

  it('skips later non-trigger nodes after a false condition', () => {
    const result = executeInternalWorkflowDefinition({
      definition: {
        nodes: [
          { id: 'trigger-1', type: 'trigger', config: {} },
          { id: 'condition-1', type: 'condition', config: { field: 'score', operator: 'greater_than', value: '50' } },
          { id: 'transform-1', type: 'transform', config: { input: '', mapping: '{"passed":true}' } },
          { id: 'trigger-2', type: 'trigger', config: {} },
        ],
      },
      input: { score: 10 },
    });

    expect(result.data).toEqual({ score: 10 });
    expect(result.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'condition-1', status: 'completed', conditionMatched: false }),
      expect.objectContaining({ nodeId: 'transform-1', status: 'skipped' }),
      expect.objectContaining({ nodeId: 'trigger-2', status: 'completed' }),
    ]));
  });

  it('continues after a true condition', () => {
    const result = executeInternalWorkflowDefinition({
      definition: {
        nodes: [
          { id: 'trigger-1', type: 'trigger', config: {} },
          { id: 'condition-1', type: 'condition', config: { field: 'status', operator: 'equals', value: 'ready' } },
          { id: 'transform-1', type: 'transform', config: { input: '', mapping: '{"processed":true}' } },
        ],
      },
      input: { status: 'ready' },
    });

    expect(result.data).toEqual({ status: 'ready', processed: true });
    expect(result.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'condition-1', conditionMatched: true }),
      expect.objectContaining({ nodeId: 'transform-1', status: 'completed' }),
    ]));
  });

  it.each(['http', 'agent', 'custom-provider'])('blocks %s nodes before execution', (type) => {
    expect(() => executeInternalWorkflowDefinition({
      definition: {
        nodes: [
          { id: 'transform-1', type: 'transform', config: { input: '', mapping: '{"changed":true}' } },
          { id: 'blocked-1', type, config: {} },
        ],
      },
      input: { original: true },
    })).toThrow('External or unsupported workflow action runtime is not enabled.');
  });

  it('fails malformed transform mappings deterministically', () => {
    expect(() => executeInternalWorkflowDefinition({
      definition: {
        nodes: [
          { id: 'trigger-1', type: 'trigger', config: {} },
          { id: 'transform-1', type: 'transform', config: { input: '', mapping: '{not-json}' } },
        ],
      },
      input: {},
    })).toThrow('Transform mapping must be a valid JSON object.');
  });

  it('supports the current condition operators', () => {
    const definitions = [
      ['equals', '10', true],
      ['not_equals', '9', true],
      ['contains', 'ell', true],
      ['greater_than', '9', true],
      ['less_than', '11', true],
    ] as const;

    for (const [operator, expected, matched] of definitions) {
      const input = operator === 'contains' ? { value: 'hello' } : { value: 10 };
      const result = executeInternalWorkflowDefinition({
        definition: { nodes: [
          { id: 'trigger-1', type: 'trigger', config: {} },
          { id: 'condition-1', type: 'condition', config: { field: 'value', operator, value: expected } },
        ] },
        input,
      });
      expect(result.steps).toEqual(expect.arrayContaining([
        expect.objectContaining({ nodeId: 'condition-1', conditionMatched: matched }),
      ]));
    }
  });
});
