import { executeAutomationWorkflowRun } from './workflow-execution-service';

function makeDependencies() {
  return {
    insertRun: jest.fn(),
    updateRun: jest.fn(),
    executeDefinition: jest.fn(),
  };
}

const workflow = {
  id: 'workflow-1',
  tenantId: 'tenant-1',
  projectId: 'project-1',
  triggerType: 'webhook',
  definition: { nodes: [{ id: 'trigger-1', type: 'trigger', config: { triggerMode: 'webhook' } }] },
  version: '7',
};
const dependenciesReadiness = { ready: true, blockers: [], agents: {} };

describe('executeAutomationWorkflowRun', () => {
  it('persists queued -> running -> completed using the unified kernel output', async () => {
    const dependencies = makeDependencies();
    dependencies.insertRun.mockResolvedValue({ id: 'run-1' });
    dependencies.executeDefinition.mockResolvedValue({ mode: 'workflow-execution', data: { ok: true }, steps: [] });

    const result = await executeAutomationWorkflowRun({ workflow, triggerType: 'webhook', input: { customer: { id: 1 } }, dependencyReadiness: dependenciesReadiness }, dependencies);

    expect(dependencies.insertRun).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', projectId: 'project-1', workflowId: 'workflow-1', triggerType: 'webhook', status: 'queued', input: { customer: { id: 1 } } }));
    expect(dependencies.updateRun).toHaveBeenNthCalledWith(1, 'run-1', expect.objectContaining({ status: 'running' }), workflow);
    expect(dependencies.updateRun).toHaveBeenNthCalledWith(2, 'run-1', expect.objectContaining({ status: 'completed', output: expect.objectContaining({ workflowVersion: '7' }), completedAt: expect.any(Date) }), workflow);
    expect(result).toEqual({ runId: 'run-1', output: expect.objectContaining({ workflowVersion: '7' }) });
  });

  it('persists a sanitized failed lifecycle and rethrows execution failures', async () => {
    const dependencies = makeDependencies();
    dependencies.insertRun.mockResolvedValue({ id: 'run-2' });
    dependencies.executeDefinition.mockRejectedValue(new Error('provider failure'));

    await expect(executeAutomationWorkflowRun({ workflow, triggerType: 'webhook', input: {}, dependencyReadiness: dependenciesReadiness }, dependencies)).rejects.toThrow('provider failure');
    expect(dependencies.updateRun).toHaveBeenLastCalledWith('run-2', expect.objectContaining({ status: 'failed', error: 'provider failure', completedAt: expect.any(Date) }), workflow);
  });

  it('rejects trigger mismatch before creating a run', async () => {
    const dependencies = makeDependencies();
    await expect(executeAutomationWorkflowRun({ workflow: { ...workflow, triggerType: 'manual' }, triggerType: 'webhook', input: {}, dependencyReadiness: dependenciesReadiness }, dependencies)).rejects.toThrow('Workflow trigger type does not allow this execution.');
    expect(dependencies.insertRun).not.toHaveBeenCalled();
  });
});
