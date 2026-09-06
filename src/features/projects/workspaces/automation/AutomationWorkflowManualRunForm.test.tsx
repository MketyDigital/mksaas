import { render, screen } from '@testing-library/react';

import { AutomationWorkflowManualRunForm } from './AutomationWorkflowManualRunForm';

const readyPreflight = { checks: [], errorCount: 0, warningCount: 0, readyCount: 3, readyForExecutionFoundation: true };

describe('AutomationWorkflowManualRunForm', () => {
  it('enables a safe manual inspection run for managers with clean preflight', () => {
    render(<AutomationWorkflowManualRunForm canManage preflight={readyPreflight} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByRole('heading', { name: 'Manual run foundation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run manual inspection' })).toBeEnabled();
    expect(screen.getByText(/does not dispatch HTTP, AI, transforms, conditions, webhooks, or retries/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
  });

  it('disables the run request when preflight is not fully ready', () => {
    render(<AutomationWorkflowManualRunForm canManage preflight={{ ...readyPreflight, warningCount: 1, readyForExecutionFoundation: false }} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByRole('button', { name: 'Run manual inspection' })).toBeDisabled();
    expect(screen.getByText(/Resolve every preflight error and warning/i)).toBeInTheDocument();
  });

  it('keeps the action protected from non-managers', () => {
    render(<AutomationWorkflowManualRunForm canManage={false} preflight={readyPreflight} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByText(/Only managers can start manual workflow run records/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run manual inspection' })).not.toBeInTheDocument();
  });
});
