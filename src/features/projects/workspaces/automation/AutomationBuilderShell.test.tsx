import { render, screen } from '@testing-library/react';

import { AutomationBuilderShell, type AutomationBuilderWorkflowSummary, buildAutomationBuilderReadiness } from './AutomationBuilderShell';

const emptyTypeDraft = { triggerMode: '', agentId: '', prompt: '', method: '', url: '', headers: '', body: '', input: '', mapping: '', field: '', operator: '', value: '' };

const workflow: AutomationBuilderWorkflowSummary = {
  id: 'workflow-1', name: 'Lead follow-up', slug: 'lead-follow-up', description: 'Follow up with new leads after they register.', status: 'draft', triggerType: 'manual', version: '1', updatedAt: new Date('2026-09-05T12:00:00Z'), nodeCount: 3,
  nodes: [
    { canConfigure: true, configDraft: { label: '', notes: '' }, configKeys: ['source'], id: 'trigger-1', isSupported: true, readinessLabel: 'Prepared', type: 'trigger', typeConfigDraft: { ...emptyTypeDraft, triggerMode: 'manual' } },
    { canConfigure: true, configDraft: { label: '', notes: '' }, configKeys: ['agentId', 'prompt'], id: 'agent-1', isSupported: true, readinessLabel: 'Prepared', type: 'agent', typeConfigDraft: { ...emptyTypeDraft, agentId: 'agent-1', prompt: 'Follow up' } },
    { canConfigure: false, configDraft: { label: '', notes: '' }, configKeys: [], id: 'custom-1', isSupported: false, readinessLabel: 'Needs review', type: 'custom-provider', typeConfigDraft: emptyTypeDraft },
  ],
};

describe('AutomationBuilderShell', () => {
  it('renders workflow builder details without execution controls', () => {
    render(<AutomationBuilderShell projectSlug="demo" recentRuns={[]} tenantSlug="acme" workflow={workflow} />);
    expect(screen.getByRole('heading', { name: 'Lead follow-up' })).toBeInTheDocument();
    expect(screen.getByText('Builder shell')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('nodes')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Definition nodes' })).toBeInTheDocument();
    expect(screen.getByText('trigger')).toBeInTheDocument();
    expect(screen.getByText('agent')).toBeInTheDocument();
    expect(screen.getByText('custom-provider')).toBeInTheDocument();
    expect(screen.getAllByText('Prepared')).toHaveLength(2);
    expect(screen.getAllByText('Needs review')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Run workflow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Activate workflow/i })).not.toBeInTheDocument();
  });

  it('keeps execution and webhook activation disabled in readiness data', () => {
    const readiness = buildAutomationBuilderReadiness(workflow);
    expect(readiness.executionEnabled).toBe(false);
    expect(readiness.webhookActivationEnabled).toBe(false);
    expect(readiness.publishEnabled).toBe(false);
    expect(readiness.definitionReady).toBe(true);
  });

  it('renders recent runs as read-only records', () => {
    render(<AutomationBuilderShell projectSlug="demo" recentRuns={[{ id: 'run-1', workflowId: 'workflow-1', status: 'failed', triggerType: 'manual', startedAt: new Date('2026-09-05T12:10:00Z'), completedAt: new Date('2026-09-05T12:11:00Z') }]} tenantSlug="acme" workflow={workflow} />);
    expect(screen.getByRole('heading', { name: 'Recent run records' })).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText(/manual trigger/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
  });
});
