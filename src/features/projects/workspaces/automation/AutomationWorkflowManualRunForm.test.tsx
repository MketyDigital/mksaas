import { render, screen } from '@testing-library/react';

import { AutomationWorkflowManualRunForm } from './AutomationWorkflowManualRunForm';

const readyPreflight = { checks: [], errorCount: 0, warningCount: 0, readyCount: 3, readyForExecutionFoundation: true };

describe('AutomationWorkflowManualRunForm', () => {
  it('enables internal-only manual execution for managers with clean preflight', () => {
    render(<AutomationWorkflowManualRunForm canManage preflight={readyPreflight} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByRole('heading', { name: 'Internal manual execution' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run internal workflow' })).toBeEnabled();
    expect(screen.getByText(/Runs trigger, transform, and condition nodes/i)).toBeInTheDocument();
    expect(screen.getByText(/HTTP, Agent, webhooks, retries, credentials, and other external actions remain disabled/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
  });

  it('disables the run request when preflight is not fully ready', () => {
    render(<AutomationWorkflowManualRunForm canManage preflight={{ ...readyPreflight, warningCount: 1, readyForExecutionFoundation: false }} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByRole('button', { name: 'Run internal workflow' })).toBeDisabled();
    expect(screen.getByText(/Resolve every preflight error and warning/i)).toBeInTheDocument();
  });

  it('keeps the action protected from non-managers', () => {
    render(<AutomationWorkflowManualRunForm canManage={false} preflight={readyPreflight} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByText(/Only managers can start manual workflow runs/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run internal workflow' })).not.toBeInTheDocument();
  });
});
