import { render, screen } from '@testing-library/react';

import { AutomationWorkflowPreflightPanel } from './AutomationWorkflowPreflightPanel';

describe('AutomationWorkflowPreflightPanel', () => {
  it('renders structured preflight results without runtime controls', () => {
    render(
      <AutomationWorkflowPreflightPanel
        preflight={{
          checks: [
            { code: 'workflow.trigger-ready', message: 'Workflow contains one trigger node.', severity: 'ready' },
            { code: 'http.url-invalid', message: 'HTTP node requires a valid http or https URL.', nodeId: 'http-1', severity: 'error' },
            { code: 'node.unsupported', message: 'custom-provider node is inspection-only until its type is supported.', nodeId: 'legacy-1', severity: 'warning' },
          ],
          errorCount: 1,
          warningCount: 1,
          readyCount: 1,
          readyForExecutionFoundation: false,
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Validate the draft before runtime exists' })).toBeInTheDocument();
    expect(screen.getByText('Needs preflight attention')).toBeInTheDocument();
    expect(screen.getByText('HTTP node requires a valid http or https URL.')).toBeInTheDocument();
    expect(screen.getByText('Node: http-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish/i })).not.toBeInTheDocument();
  });

  it('renders the future-foundation readiness label only when all checks are clean', () => {
    render(
      <AutomationWorkflowPreflightPanel
        preflight={{ checks: [{ code: 'workflow.trigger-ready', message: 'Workflow contains one trigger node.', severity: 'ready' }], errorCount: 0, warningCount: 0, readyCount: 1, readyForExecutionFoundation: true }}
      />,
    );

    expect(screen.getByText('Ready for execution foundation')).toBeInTheDocument();
  });
});
