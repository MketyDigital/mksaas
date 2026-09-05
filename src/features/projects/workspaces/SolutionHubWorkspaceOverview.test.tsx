import { render, screen, within } from '@testing-library/react';

import { buildSolutionHubCapabilities, SolutionHubWorkspaceOverview } from './SolutionHubWorkspaceOverview';

describe('SolutionHubWorkspaceOverview', () => {
  it('renders the SolutionHub capability map', () => {
    render(<SolutionHubWorkspaceOverview />);

    expect(screen.getByRole('heading', { name: /Package repeatable business systems safely/i })).toBeInTheDocument();

    for (const capability of buildSolutionHubCapabilities()) {
      expect(screen.getByText(capability.title)).toBeInTheDocument();
      expect(screen.getByText(capability.description)).toBeInTheDocument();
    }
  });

  it('keeps enterprise requests and install flow protected', () => {
    const protectedCapabilities = buildSolutionHubCapabilities().filter((capability) => capability.status === 'protected');

    expect(protectedCapabilities.map((capability) => capability.key)).toEqual(['enterprise-requests', 'install-flow']);

    render(<SolutionHubWorkspaceOverview />);

    for (const capability of protectedCapabilities) {
      const heading = screen.getByRole('heading', { name: capability.title });
      const card = heading.closest('article');
      expect(card).not.toBeNull();
      expect(within(card as HTMLElement).getByText('Protected')).toBeInTheDocument();
    }
  });

  it('does not expose an active install action yet', () => {
    render(<SolutionHubWorkspaceOverview />);

    expect(screen.queryByRole('link', { name: /install/i })).not.toBeInTheDocument();
    expect(screen.getByText(/before any solution can be cloned or installed/i)).toBeInTheDocument();
  });
});
