import { render, screen } from '@testing-library/react';
import { AutomationWorkflowManualRunForm } from './AutomationWorkflowManualRunForm';

const readyPreflight = { checks: [], errorCount: 0, warningCount: 0, readyCount: 3, readyForExecutionFoundation: true };
const readyRuntime = { ready: true, blockers: [] };
const readyDependencies = { ready: true, blockers: [], agents: {} };

describe('AutomationWorkflowManualRunForm', () => {
  it('enables published Agent-capable execution when every readiness layer is clean', () => {
    render(<AutomationWorkflowManualRunForm canManage dependencyReadiness={readyDependencies} preflight={readyPreflight} runtimeReadiness={readyRuntime} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByRole('button', { name: 'Run workflow' })).toBeEnabled();
    expect(screen.getByText(/published Agent versions/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent tools, retries, arbitrary credentials, and schedules remain disabled/i)).toBeInTheDocument();
  });
  it('disables execution and renders dependency blockers', () => {
    render(<AutomationWorkflowManualRunForm canManage dependencyReadiness={{ ready: false, blockers: [{ code: 'agent.dependency-no-published-version', message: 'Publish this Agent before running the workflow.', nodeId: 'agent-1' }], agents: {} }} preflight={readyPreflight} runtimeReadiness={readyRuntime} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.getByRole('button', { name: 'Run workflow' })).toBeDisabled();
    expect(screen.getByText('Publish this Agent before running the workflow.')).toBeInTheDocument();
  });
  it('keeps non-managers protected', () => {
    render(<AutomationWorkflowManualRunForm canManage={false} dependencyReadiness={readyDependencies} preflight={readyPreflight} runtimeReadiness={readyRuntime} projectSlug="demo" tenantSlug="acme" workflowSlug="lead-follow-up" />);
    expect(screen.queryByRole('button', { name: 'Run workflow' })).not.toBeInTheDocument();
  });
});
