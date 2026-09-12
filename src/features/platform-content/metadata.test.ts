import { buildMketyMetadata, MKETY_PUBLIC_ORIGIN } from './metadata';
import type { PlatformSiteSettingsInput } from './schemas';

const settings: PlatformSiteSettingsInput = {
  brandName: 'Mkety',
  primaryColor: '#6D5DF6',
  secondaryColor: '#A855F7',
  accentColor: '#22D3EE',
  defaultSeoTitle: 'Mkety | Build, automate, deploy, and operate',
  defaultSeoDescription: 'Mkety public description',
  socialImageUrl: 'https://assets.example.com/mkety-share.png',
  legalLinks: [],
};

describe('Mkety public metadata', () => {
  it('uses mkety.com as the canonical public origin', () => {
    expect(MKETY_PUBLIC_ORIGIN).toBe('https://mkety.com');
  });

  it('builds Mkety metadata without legacy template branding', () => {
    const metadata = buildMketyMetadata({ settings, path: '/platform' });

    expect(metadata.title).toContain('Mkety');
    expect(String(metadata.title)).not.toContain('Next.js SaaS AI Template');
    expect(metadata.description).toBe('Mkety public description');
    expect(metadata.alternates?.canonical).toBe('https://mkety.com/platform');
    expect(metadata.openGraph?.siteName).toBe('Mkety');
  });

  it('uses page SEO overrides while keeping the canonical domain code-owned', () => {
    const metadata = buildMketyMetadata({
      settings,
      path: 'https://evil.example/pricing',
      title: 'Pricing | Mkety',
      description: 'Plans, pricing, credits and usage for Mkety.',
    });

    expect(metadata.title).toBe('Pricing | Mkety');
    expect(metadata.description).toBe('Plans, pricing, credits and usage for Mkety.');
    expect(metadata.alternates?.canonical).toBe('https://mkety.com/pricing');
  });

  it('includes the configured social image when it is an HTTPS URL', () => {
    const metadata = buildMketyMetadata({ settings, path: '/' });
    const images = metadata.openGraph?.images;

    expect(images).toEqual(expect.arrayContaining(['https://assets.example.com/mkety-share.png']));
  });
});
