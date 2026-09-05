import { render, screen } from '@testing-library/react';

import { AutomationWorkflowNodeConfigDraftForm } from './AutomationWorkflowNodeConfigDraftForm';

const emptyTypeDraft = { triggerMode: '', agentId: '', prompt: '', method: '', url: '', headers: '', body: '', input: '', mapping: '', field: '', operator: '', value: '' };

const nodes = [
  { canConfigure: true, configDraft: { label: 'Follow up', notes: 'Internal only' }, configKeys: ['label', 'notes', 'agentId'], id: 'agent-1', isSupported: true, readinessLabel: 'Prepared' as const, type: 'agent', typeConfigDraft: { ...emptyTypeDraft, agentId: 'agent_123', prompt: 'Draft prompt' } },
  { canConfigure: true, configDraft: { label: '', notes: '' }, configKeys: ['method', 'url'], id: 'http-2', isSupported: true, readinessLabel: 'Prepared' as const, type: 'http', typeConfigDraft: { ...emptyTypeDraft, method: 'POST', url: 'https://example.com' } },
  { canConfigure: false, configDraft: { label: '', notes: '' }, configKeys: ['custom'], id: 'legacy-2', isSupported: false, readinessLabel: 'Needs review' as const, type: 'custom-provider', typeConfigDraft: emptyTypeDraft },
];

describe('AutomationWorkflowNodeConfigDraftForm', () => {
  it('renders type-specific draft fields for configurable nodes without runtime controls', () => {
    render(<AutomationWorkflowNodeConfigDraftForm canManage nodes={nodes} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);

    expect(screen.getByRole('heading', { name: 'Configure node drafts' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('agent_123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Draft prompt')).toBeInTheDocument();
    expect(screen.getByLabelText('HTTP method for http-2')).toHaveValue('POST');
    expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save agent-1 draft config' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save legacy-2 draft config' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Credentials/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
  });

  it('renders a permission boundary for non-managers', () => {
    render(<AutomationWorkflowNodeConfigDraftForm canManage={false} nodes={nodes} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByText(/Only managers can edit node draft configuration/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /draft config/i })).not.toBeInTheDocument();
  });
});
