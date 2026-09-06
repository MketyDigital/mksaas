import { render, screen } from '@testing-library/react';

import { AutomationWorkflowWebhookPanel } from './AutomationWorkflowWebhookPanel';

jest.mock('./actions', () => ({ disableAutomationWorkflowWebhook: jest.fn() }));
jest.mock('./webhook-actions', () => ({ createAutomationWorkflowWebhookState: jest.fn(), rotateAutomationWorkflowWebhookSecretState: jest.fn() }));

describe('AutomationWorkflowWebhookPanel', () => {
  const baseProps = {
    canManage: true,
    projectSlug: 'project-one',
    tenantSlug: 'tenant-one',
    workflowSlug: 'lead-capture',
    workflowTriggerType: 'webhook',
    appUrl: 'https://preview.mkety.workers.dev',
  };

  it('shows manager provisioning guidance when a webhook workflow has no endpoint', () => {
    render(<AutomationWorkflowWebhookPanel {...baseProps} endpoint={null} />);
    expect(screen.getByText('Webhook trigger')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create webhook endpoint' })).toBeInTheDocument();
    expect(screen.getByText(/X-Mkety-Signature/)).toBeInTheDocument();
    expect(screen.getByText(/secret is shown only once/i)).toBeInTheDocument();
  });

  it('shows the public endpoint and rotate/disable controls without exposing stored secret material', () => {
    const { container } = render(<AutomationWorkflowWebhookPanel {...baseProps} endpoint={{ endpointId: 'public-endpoint', status: 'active' }} />);
    expect(screen.getByText('https://preview.mkety.workers.dev/api/automation/webhooks/public-endpoint')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rotate secret' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable webhook' })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/ciphertext|fingerprint/i);
  });

  it('protects management controls from non-managers and explains non-webhook workflows', () => {
    const { rerender } = render(<AutomationWorkflowWebhookPanel {...baseProps} canManage={false} endpoint={null} />);
    expect(screen.getByText(/only managers can manage webhook endpoints/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<AutomationWorkflowWebhookPanel {...baseProps} workflowTriggerType="manual" endpoint={null} />);
    expect(screen.getByText(/change the workflow trigger to webhook/i)).toBeInTheDocument();
  });
});
