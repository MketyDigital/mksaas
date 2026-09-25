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
  publicAiLeadCaptureEnabled: true,
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

    expect(JSON.stringify(images)).toContain('https://assets.example.com/mkety-share.png');
  });

  it('falls back to Mkety-owned social and icon assets when CMS asset URLs are absent', () => {
    const metadata = buildMketyMetadata({
      settings: { ...settings, socialImageUrl: undefined, faviconUrl: undefined, logoUrl: undefined },
      path: '/enterprise',
    });

    expect(JSON.stringify(metadata.openGraph?.images)).toContain('https://mkety.com/mkety-social-card.png');
    expect(JSON.stringify(metadata.icons)).toContain('/favicon.ico');
    expect(JSON.stringify(metadata.icons)).toContain('/icon.png');
    expect(JSON.stringify(metadata.icons)).toContain('/apple-icon.png');
  });

  it('publishes consistent Mkety ownership and technology metadata', () => {
    const metadata = buildMketyMetadata({ settings, path: '/' });

    expect(metadata.creator).toBe('Mkety');
    expect(metadata.publisher).toBe('Mkety');
    expect(metadata.category).toBe('technology');
    expect(metadata.manifest).toBe('/manifest.webmanifest');
  });
});
