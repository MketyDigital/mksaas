import { managedEnterpriseAiHostname, resolveEnterpriseAiBrand } from './white-label';

describe('Enterprise AI white-label branding', () => {
  it('falls back safely when white-labeling is disabled', () => {
    const brand = resolveEnterpriseAiBrand({} as never, 'Acme Corp');

    expect(brand).toMatchObject({
      enabled: false,
      brandName: 'Acme Corp',
      productName: 'AI Assistant',
      logoUrl: null,
      customHostname: null,
      hideMketyBranding: false,
      loginHeading: 'Sign in to Acme Corp',
    });
  });

  it('resolves configured customer branding and normalizes the custom hostname', () => {
    const brand = resolveEnterpriseAiBrand({
      enterpriseAi: {
        whiteLabel: {
          enabled: true,
          brandName: 'Starpips',
          productName: 'Starpips AI',
          logoUrl: 'https://cdn.example.com/logo.png',
          primaryColor: '#001122',
          secondaryColor: '#223344',
          accentColor: '#445566',
          supportEmail: 'support@example.com',
          loginHeading: 'Welcome to Starpips AI',
          customHostname: 'AI.STARPIPSFOREX.COM',
          hideMketyBranding: true,
        },
      },
    } as never, 'Fallback');

    expect(brand).toMatchObject({
      enabled: true,
      brandName: 'Starpips',
      productName: 'Starpips AI',
      logoUrl: 'https://cdn.example.com/logo.png',
      primaryColor: '#001122',
      secondaryColor: '#223344',
      accentColor: '#445566',
      supportEmail: 'support@example.com',
      loginHeading: 'Welcome to Starpips AI',
      customHostname: 'ai.starpipsforex.com',
      hideMketyBranding: true,
    });
  });

  it('normalizes managed Enterprise AI hostnames', () => {
    expect(managedEnterpriseAiHostname('StArPiPs')).toBe('starpips.mkety.app');
  });
});
