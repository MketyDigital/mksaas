import { validateAutomationWorkflowRuntimeReadiness } from './workflow-runtime-readiness';

describe('validateAutomationWorkflowRuntimeReadiness', () => {
  const trigger = { id: 'trigger-1', type: 'trigger', config: { triggerMode: 'manual' } };

  it('accepts internal-only and valid HTTPS HTTP workflows', () => {
    expect(validateAutomationWorkflowRuntimeReadiness({ nodes: [trigger, { id: 'transform-1', type: 'transform', config: { input: 'x', mapping: '{"ok":true}' } }] })).toEqual({ ready: true, blockers: [] });
    expect(validateAutomationWorkflowRuntimeReadiness({ nodes: [trigger, { id: 'http-1', type: 'http', config: { method: 'POST', url: 'https://api.example.com/items', body: '{"id":"{{itemId}}"}' } }] }).ready).toBe(true);
  });

  it('blocks non-HTTPS, agent, unknown, malformed, bad method, and invalid JSON bodies', () => {
    const cases = [
      [{ nodes: [trigger, { id: 'http-1', type: 'http', config: { method: 'GET', url: 'http://example.com' } }] }, 'http.runtime-https-required'],
      [{ nodes: [trigger, { id: 'agent-1', type: 'agent', config: { agentId: 'a', prompt: 'p' } }] }, 'agent.runtime-disabled'],
      [{ nodes: [trigger, { id: 'future-1', type: 'future', config: {} }] }, 'node.runtime-unsupported'],
      [{ nodes: [trigger, null] }, 'node.runtime-malformed'],
      [{ nodes: [trigger, { id: 'http-1', type: 'http', config: { method: 'TRACE', url: 'https://example.com' } }] }, 'http.runtime-method-unsupported'],
      [{ nodes: [trigger, { id: 'http-1', type: 'http', config: { method: 'POST', url: 'https://example.com', body: '{bad-json}' } }] }, 'http.runtime-body-invalid'],
    ] as const;

    for (const [definition, code] of cases) {
      expect(validateAutomationWorkflowRuntimeReadiness(definition).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
    }
  });

  it('does not fail GET or DELETE solely because a body draft exists and does not mutate input', () => {
    const definition = { nodes: [trigger, { id: 'http-1', type: 'http', config: { method: 'DELETE', url: 'https://example.com', body: '{not-json}' } }] };
    const before = JSON.parse(JSON.stringify(definition));
    expect(validateAutomationWorkflowRuntimeReadiness(definition)).toEqual({ ready: true, blockers: [] });
    expect(definition).toEqual(before);
  });
});
