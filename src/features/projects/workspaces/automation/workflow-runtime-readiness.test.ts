import { validateAutomationWorkflowRuntimeReadiness } from './workflow-runtime-readiness';

describe('validateAutomationWorkflowRuntimeReadiness', () => {
  const trigger = { id: 'trigger-1', type: 'trigger', config: { triggerMode: 'manual' } };
  it('accepts configured Agent nodes as runtime-capable', () => {
    expect(validateAutomationWorkflowRuntimeReadiness({ nodes: [trigger, { id: 'agent-1', type: 'agent', config: { agentId: 'agent-a', prompt: 'Summarize {{http.body}}' } }] })).toEqual({ ready: true, blockers: [] });
  });
  it('requires agent id and prompt', () => {
    expect(validateAutomationWorkflowRuntimeReadiness({ nodes: [{ id: 'a1', type: 'agent', config: { agentId: '', prompt: 'x' } }, { id: 'a2', type: 'agent', config: { agentId: 'a', prompt: '' } }] }).blockers.map((b) => b.code)).toEqual(expect.arrayContaining(['agent.runtime-agent-required', 'agent.runtime-prompt-required']));
  });
  it('retains HTTP and unknown-node guards without mutation', () => {
    const definition = { nodes: [trigger, { id: 'h', type: 'http', config: { method: 'POST', url: 'https://example.com', body: '{"x":1}' } }, { id: 'f', type: 'future', config: {} }] };
    const before = JSON.parse(JSON.stringify(definition));
    const result = validateAutomationWorkflowRuntimeReadiness(definition);
    expect(result.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'node.runtime-unsupported' })]));
    expect(definition).toEqual(before);
  });
});
