import { render, screen } from '@testing-library/react';

import { MketyPublicShell } from './MketyPublicShell';
import { defaultFooterGroups, defaultPlatformNavigation, defaultPlatformSiteSettings } from '../../defaults';

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('MketyPublicShell', () => {
  it('renders consistent public CTAs, legal destinations and content', () => {
    render(
      <MketyPublicShell
        settings={defaultPlatformSiteSettings}
        navigation={defaultPlatformNavigation}
        footerGroups={defaultFooterGroups}
      >
        <h1>Public content</h1>
      </MketyPublicShell>,
    );

    expect(screen.getByRole('link', { name: 'Mkety' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/create-workspace');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('heading', { name: 'Public content' })).toBeInTheDocument();
  });

  it('provides the global Mkety app dock and AI command surface', () => {
    render(
      <MketyPublicShell
        settings={defaultPlatformSiteSettings}
        navigation={defaultPlatformNavigation}
        footerGroups={defaultFooterGroups}
      >
        <div>Body</div>
      </MketyPublicShell>,
    );

    expect(screen.getByRole('navigation', { name: /mkety app navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ask mkety ai/i })).toHaveAttribute('data-surface', 'mkety-ai-command');
  });
});
