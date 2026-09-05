import { render, screen } from '@testing-library/react';

import { AutomationWorkflowNodeStructureDraftForm } from './AutomationWorkflowNodeStructureDraftForm';

const emptyTypeDraft = { triggerMode: '', agentId: '', prompt: '', method: '', url: '', headers: '', body: '', input: '', mapping: '', field: '', operator: '', value: '' };
const nodes = [
  { canConfigure: true, configDraft: { label: '', notes: '' }, configKeys: [], id: 'trigger-1', isSupported: true, readinessLabel: 'Prepared' as const, type: 'trigger', typeConfigDraft: emptyTypeDraft },
  { canConfigure: false, configDraft: { label: '', notes: '' }, configKeys: [], id: 'legacy-1', isSupported: false, readinessLabel: 'Needs review' as const, type: 'custom-provider', typeConfigDraft: emptyTypeDraft },
  { canConfigure: true, configDraft: { label: '', notes: '' }, configKeys: [], id: 'agent-1', isSupported: true, readinessLabel: 'Prepared' as const, type: 'agent', typeConfigDraft: emptyTypeDraft },
];

describe('AutomationWorkflowNodeStructureDraftForm', () => {
  it('renders structure controls for supported nodes while keeping unknown nodes protected', () => {
    render(<AutomationWorkflowNodeStructureDraftForm canManage nodes={nodes} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByRole('heading', { name: 'Arrange draft nodes' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Duplicate' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Delete draft node' })).toHaveLength(2);
    expect(screen.getByText('Inspection-only node')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
  });

  it('renders a permission boundary for non-managers', () => {
    render(<AutomationWorkflowNodeStructureDraftForm canManage={false} nodes={nodes} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByText(/Only managers can move, duplicate, or delete supported draft nodes/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument();
  });
});
