import { render, screen } from '@testing-library/react';

import { AutomationWorkflowManualRunForm } from './AutomationWorkflowManualRunForm';

const readyPreflight = { checks: [], errorCount: 0, warningCount: 0, readyCount: 3, readyForExecutionFoundation: true };
const readyRuntime = { ready: true, blockers: [] };

describe('AutomationWorkflowManualRunForm', () => {
  it('enables HTTP-capable manual execution for managers when both readiness gates are clean', () => {
    render(<AutomationWorkflowManualRunForm canManage preflight={readyPreflight} runtimeReadiness={readyRuntime} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByRole('heading', { name: 'Manual workflow execution' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run workflow' })).toBeEnabled();
    expect(screen.getByText(/guarded HTTPS actions/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent actions, webhooks, retries, and credentials are not yet enabled/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish/i })).not.toBeInTheDocument();
  });

  it('disables execution and explains runtime blockers', () => {
    render(<AutomationWorkflowManualRunForm canManage preflight={readyPreflight} runtimeReadiness={{ ready: false, blockers: [{ code: 'agent.runtime-disabled', message: 'Agent action runtime is not enabled yet.', nodeId: 'agent-1' }] }} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByRole('button', { name: 'Run workflow' })).toBeDisabled();
    expect(screen.getByText(/Resolve runtime readiness blockers/i)).toBeInTheDocument();
    expect(screen.getByText('Agent action runtime is not enabled yet.')).toBeInTheDocument();
  });

  it('keeps the action protected from non-managers', () => {
    render(<AutomationWorkflowManualRunForm canManage={false} preflight={readyPreflight} runtimeReadiness={readyRuntime} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByText(/Only managers can start manual workflow runs/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run workflow' })).not.toBeInTheDocument();
  });
});
