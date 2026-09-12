import { fireEvent, render, screen } from '@testing-library/react';

import { MketyPublicDock } from './MketyPublicDock';

const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

describe('MketyPublicDock', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  it('renders the approved five primary app tabs', () => {
    render(<MketyPublicDock />);

    expect(screen.getByRole('navigation', { name: /mkety app navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Platform' })).toHaveAttribute('href', '/platform');
    expect(screen.getByRole('link', { name: 'Academy' })).toHaveAttribute('href', '/academy');
    expect(screen.getByRole('link', { name: 'SolutionHub' })).toHaveAttribute('href', '/solutions');
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('opens the approved secondary destinations from More', () => {
    render(<MketyPublicDock />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));

    expect(screen.getByRole('link', { name: 'Workspaces' })).toHaveAttribute('href', '/workspaces');
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: 'Enterprise' })).toHaveAttribute('href', '/enterprise');
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
  });

  it('marks direct and More-owned routes as active', () => {
    mockUsePathname.mockReturnValue('/academy');
    const { rerender } = render(<MketyPublicDock />);
    expect(screen.getByRole('link', { name: 'Academy' })).toHaveAttribute('aria-current', 'page');

    mockUsePathname.mockReturnValue('/pricing');
    rerender(<MketyPublicDock />);
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('data-active', 'true');
  });
});
