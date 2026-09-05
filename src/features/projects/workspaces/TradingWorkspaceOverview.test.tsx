import { render, screen } from '@testing-library/react';

import { TradingWorkspaceOverview, tradingWorkspaceSurfaces } from './TradingWorkspaceOverview';

describe('TradingWorkspaceOverview', () => {
  it('renders the Trading enterprise-only boundary', () => {
    render(<TradingWorkspaceOverview />);

    expect(screen.getByRole('heading', { name: /custom enterprise systems only/i })).toBeInTheDocument();
    expect(screen.getByText(/not a live trading product/i)).toBeInTheDocument();
    expect(screen.getByText(/Enterprise gated/i)).toBeInTheDocument();
  });

  it('keeps broker, signals, copy-trading, and execution surfaces non-live', () => {
    const protectedOrBlocked = tradingWorkspaceSurfaces.filter((surface) =>
      ['broker-integrations', 'signals', 'copy-trading', 'execution'].includes(surface.key),
    );

    expect(protectedOrBlocked).toHaveLength(4);
    expect(protectedOrBlocked.every((surface) => surface.status === 'protected' || surface.status === 'blocked')).toBe(true);
    expect(protectedOrBlocked.map((surface) => surface.title)).toEqual([
      'Broker integrations',
      'Signals',
      'Copy trading',
      'Execution',
    ]);
  });

  it('does not expose trading execution or broker links', () => {
    render(<TradingWorkspaceOverview />);

    expect(screen.queryByRole('link', { name: /connect broker/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create signal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /start copy trading/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /execute trade/i })).not.toBeInTheDocument();
  });
});
