import { requireEntitlement } from '@/features/entitlements/server/authorization';
import { consumeCredits } from '@/features/usage-credits/server/service';

import { executeAutomationWorkflowRun } from './workflow-execution-service';

jest.mock('@/features/entitlements/server/authorization', () => ({ requireEntitlement: jest.fn() }));
jest.mock('@/features/usage-credits/server/service', () => ({ consumeCredits: jest.fn() }));

const requireEntitlementMock = jest.mocked(requireEntitlement);
const consumeCreditsMock = jest.mocked(consumeCredits);

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
  beforeEach(() => {
    jest.clearAllMocks();
    requireEntitlementMock.mockResolvedValue();
    consumeCreditsMock.mockResolvedValue({
      balance: {
        tenantId: 'tenant-1',
        availableCredits: 99n,
        lifetimeGranted: 100n,
        lifetimeConsumed: 1n,
      },
      ledgerEntryId: 'credit-ledger-1',
    });
  });

  it('authorizes and consumes one workflow execution credit before running the definition', async () => {
    const dependencies = makeDependencies();
    dependencies.insertRun.mockResolvedValue({ id: 'run-1' });
    dependencies.executeDefinition.mockResolvedValue({ mode: 'workflow-execution', data: { ok: true }, steps: [] });

    const result = await executeAutomationWorkflowRun({ workflow, triggerType: 'webhook', input: { customer: { id: 1 } }, dependencyReadiness: dependenciesReadiness }, dependencies);

    expect(requireEntitlementMock).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      entitlement: 'workspace.workflows',
    });
    expect(consumeCreditsMock).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      meter: 'workflow.execution',
      quantity: 1n,
      credits: 1n,
      idempotencyKey: 'workflow-run:run-1:execution',
      source: 'automation_workflow_run',
      projectId: 'project-1',
      workspaceKey: 'automation',
    });
    expect(requireEntitlementMock.mock.invocationCallOrder[0]).toBeLessThan(consumeCreditsMock.mock.invocationCallOrder[0]!);
    expect(consumeCreditsMock.mock.invocationCallOrder[0]).toBeLessThan(dependencies.executeDefinition.mock.invocationCallOrder[0]!);
    expect(dependencies.insertRun).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', projectId: 'project-1', workflowId: 'workflow-1', triggerType: 'webhook', status: 'queued', input: { customer: { id: 1 } } }));
    expect(dependencies.updateRun).toHaveBeenNthCalledWith(1, 'run-1', expect.objectContaining({ status: 'running' }), workflow);
    expect(dependencies.updateRun).toHaveBeenNthCalledWith(2, 'run-1', expect.objectContaining({ status: 'completed', output: expect.objectContaining({ workflowVersion: '7' }), completedAt: expect.any(Date) }), workflow);
    expect(result).toEqual({ runId: 'run-1', output: expect.objectContaining({ workflowVersion: '7' }) });
  });

  it('prevents workflow execution when the tenant lacks the workflow entitlement', async () => {
    const dependencies = makeDependencies();
    dependencies.insertRun.mockResolvedValue({ id: 'run-entitlement-denied' });
    requireEntitlementMock.mockRejectedValue(new Error('entitlement denied'));

    await expect(executeAutomationWorkflowRun({ workflow, triggerType: 'webhook', input: {}, dependencyReadiness: dependenciesReadiness }, dependencies)).rejects.toThrow('entitlement denied');

    expect(consumeCreditsMock).not.toHaveBeenCalled();
    expect(dependencies.executeDefinition).not.toHaveBeenCalled();
    expect(dependencies.updateRun).toHaveBeenLastCalledWith(
      'run-entitlement-denied',
      expect.objectContaining({ status: 'failed', error: 'entitlement denied' }),
      workflow,
    );
  });

  it('prevents workflow execution when credits cannot be consumed', async () => {
    const dependencies = makeDependencies();
    dependencies.insertRun.mockResolvedValue({ id: 'run-credit-denied' });
    consumeCreditsMock.mockRejectedValue(new Error('insufficient credits'));

    await expect(executeAutomationWorkflowRun({ workflow, triggerType: 'webhook', input: {}, dependencyReadiness: dependenciesReadiness }, dependencies)).rejects.toThrow('insufficient credits');

    expect(requireEntitlementMock).toHaveBeenCalledTimes(1);
    expect(dependencies.executeDefinition).not.toHaveBeenCalled();
    expect(dependencies.updateRun).toHaveBeenLastCalledWith(
      'run-credit-denied',
      expect.objectContaining({ status: 'failed', error: 'insufficient credits' }),
      workflow,
    );
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
    expect(requireEntitlementMock).not.toHaveBeenCalled();
    expect(consumeCreditsMock).not.toHaveBeenCalled();
  });
});
