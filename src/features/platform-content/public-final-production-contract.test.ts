/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

describe('final public production UX, support, docs and auth contract', () => {
  it('keeps Explore Mkety mobile-safe and horizontally scrollable', async () => {
    const source = await read('src/features/platform-content/components/public/MketyPublicExperience.tsx');
    expect(source).toContain('touch-pan-x');
    expect(source).toContain('overflow-x-auto');
    expect(source).toContain('w-[calc(100%+1rem)]');
    expect(source).toContain('min-w-max');
    expect(source).toContain('break-words');
    expect(source).toContain('[overflow-wrap:anywhere]');
    expect(source).toContain('grid-cols-1');
    expect(source).toContain('max-w-full');
    expect(source).toContain('overflow-x-hidden');
    expect(source).toContain('box-border');
    expect(source).toContain('overflow-hidden rounded-[2rem]');
  });

  it('uses only the five real local Academy hub images', async () => {
    const source = await read('src/features/platform-content/components/public/MketyPublicExperience.tsx');
    for (let i = 1; i <= 5; i += 1) {
      expect(source).toContain(`/academy-hubs/class${i}.jpg`);
    }
    expect(source).not.toContain('images.unsplash.com');
  });

  it('keeps the Public AI command box below the header with the Mkety logo', async () => {
    const source = await read('src/features/public-assistant/components/MketyPublicAssistant.tsx');
    expect(source).toContain("top-[4.5rem]");
    expect(source).toContain('/mkety-logo.png');
    expect(source).toContain('bg-transparent');
    expect(source).not.toContain('shadow-primary/10 backdrop-blur-xl');
    expect(source).toContain("window.location.hash === '#mkety-ai'");
  });

  it('drives docs navigation from the same published CMS tree as article routing', async () => {
    const [layout, sidebar, article] = await Promise.all([
      read('src/app/(docs)/docs/layout.tsx'),
      read('src/features/docs/components/DocsSidebar.tsx'),
      read('src/app/(docs)/docs/[...slug]/page.tsx'),
    ]);
    expect(layout).toContain('getPublishedDocsTree');
    expect(sidebar).toContain('docsTree.categories');
    expect(sidebar).toContain('docsTree.articles');
    expect(sidebar).not.toContain('docSections');
    expect(article).toContain('Previous');
    expect(article).toContain('Next');
  });

  it('keeps Academy sales public-first while exposing a separate learning-access CTA and admin-managed tier cards', async () => {
    const [pages, admin] = await Promise.all([
      read('src/features/platform-content/public-page-defaults.ts'),
      read('src/app/(tenant)/t/[tenant]/admin/platform-control/public-site/[section]/page.tsx'),
    ]);

    expect(pages).toContain("label: 'Ask Mkety AI about Academy'");
    expect(pages).toContain("label: 'Check current courses and pricing'");
    expect(pages).toContain("label: 'Sign in to Mkety Academy'");
    expect(pages).toContain("href: 'https://academy.mkety.com'");
    expect(pages).toContain("badge: 'Ask AI for current options'");
    expect(admin).toContain('Academy courses with multiple independent tier cards per course');
    expect(admin).toContain('Academy tier title/description/price badge/enrolment CTA');
    expect(admin).toContain('Academy ready-to-learn access CTA');
  });

  it('keeps Trading Workspace visibly represented as Custom / Enterprise on pricing and Workspaces', async () => {
    const [pages, defaults] = await Promise.all([
      read('src/features/platform-content/public-page-defaults.ts'),
      read('src/features/platform-content/defaults.ts'),
    ]);

    expect(pages).toContain("title: 'Trading Workspace'");
    expect(pages).toContain("badge: 'Custom / Enterprise'");
    expect(defaults).toContain("key: 'trading'");
    expect(defaults).toContain("title: 'Trading Workspace'");
  });

  it('keeps public support and AI controls admin-managed through site settings', async () => {
    const [schema, defaults, actions, admin] = await Promise.all([
      read('src/features/platform-content/schemas.ts'),
      read('src/features/platform-content/defaults.ts'),
      read('src/features/platform-content/server/actions.ts'),
      read('src/app/(tenant)/t/[tenant]/admin/platform-control/public-site/[section]/page.tsx'),
    ]);
    for (const field of [
      'salesEmail',
      'telegramHref',
      'publicAiPrompt',
      'publicAiFallbackMessage',
      'publicAiLeadCaptureEnabled',
    ]) {
      expect(schema).toContain(field);
      expect(defaults).toContain(field);
      expect(actions).toContain(field);
    }
    expect(admin).toContain('Brand, Support & AI Settings');
  });

  it('uses docs-first support, optional lead metadata and deterministic fallback', async () => {
    const [support, runtime] = await Promise.all([
      read('src/features/public-assistant/server/support.ts'),
      read('src/features/public-assistant/server/runtime.ts'),
    ]);
    expect(support).toContain('SUPPORT_PATTERN');
    expect(support).toContain("tools.add('search_public_docs')");
    expect(runtime).toContain('detectLeadMetadata');
    expect(runtime).toContain('publicAiLeadCaptureEnabled');
    expect(runtime).toContain('deterministicFallback');
    expect(runtime).toContain('if (!config.enabled)');
    expect(runtime).toContain('if (!primary)');
    expect(runtime).toContain('returnDeterministicFallback');
    expect(runtime).toContain('mailto:');
    expect(runtime).toContain('telegramHref');
  });

  it('shows USD currency on calculated prepaid totals', async () => {
    const pricing = await read('src/features/platform-content/components/public/pages/MketyPricingPlans.tsx');
    expect(pricing).toContain("return '$' + (Number(amountMinor) / 100).toFixed(2);");
    expect(pricing).toContain('data-plan-price={quote ? `${plan.key}:${formatUsd(quote.amountMinor)}` : undefined}');
  });

  it('routes contact and Enterprise sales through Public AI first', async () => {
    const [defaults, pages] = await Promise.all([
      read('src/features/platform-content/defaults.ts'),
      read('src/features/platform-content/public-page-defaults.ts'),
    ]);
    expect(defaults).toContain("contactHref: '/contact#mkety-ai'");
    expect(defaults).toContain("ctaHref: '/contact#mkety-ai'");
    expect(pages).toContain("href: '#mkety-ai'");
  });

  it('sends login and signup straight to their branded hosted auth intent', async () => {
    const [login, signup] = await Promise.all([
      read('src/app/(auth)/login/page.tsx'),
      read('src/app/(auth)/signup/page.tsx'),
    ]);
    expect(login).toContain('intent=signin');
    expect(signup).toContain('intent=signup');
    expect(login).not.toContain('<LoginForm');
    expect(signup).not.toContain('<LoginForm');
  });

  it('configures hosted auth legal/help/support links to Mkety destinations', async () => {
    const workflow = await read('.github/workflows/mkety-branded-auth-provision.yml');
    expect(workflow).toContain('SetLinkSettings');
    expect(workflow).toContain('GetLinkSettings');
    expect(workflow).toContain('https://mkety.com/terms');
    expect(workflow).toContain('https://mkety.com/privacy');
    expect(workflow).toContain('https://mkety.com/docs');
    expect(workflow).toContain('mailto:support@mkety.com');
  });

  it('smokes the real Academy images and every rendered docs link before release', async () => {
    const [candidate, production] = await Promise.all([
      read('.github/workflows/mkety-public-candidate-deploy.yml'),
      read('.github/workflows/mkety-public-production-cutover.yml'),
    ]);
    for (const source of [candidate, production]) {
      expect(source).toContain('class1.jpg class2.jpg class3.jpg class4.jpg class5.jpg');
      expect(source).toContain('Docs index rendered no article links.');
      expect(source).toContain('Rendered docs link failed:');
      expect(source).toContain('Academy page missing Courses & tiers section.');
      expect(source).toContain('Academy page missing ready-to-learn handoff.');
      expect(source).toContain('Starter price card missing exact USD-formatted $5.99 amount.');
      expect(source).toContain('data-plan-price="starter:$5.99"');
      expect(source).toContain('Pricing page missing Trading Workspace.');
      expect(source).toContain('Workspaces page missing Trading Workspace.');
      expect(source).toContain('Homepage must not bypass AI-first Academy discovery.');
    }
  });

  it('keeps the support settings migration additive', async () => {
    const migration = await read('src/shared/db/migrations/0016_public_support_ai_settings.sql');
    expect(migration).toContain('public_ai_fallback_message');
    expect(migration).toContain('public_ai_lead_capture_enabled');
    expect(migration).not.toMatch(/DROP TABLE|DROP SCHEMA|TRUNCATE/i);
  });
});


describe('final Academy and support handoff contract', () => {
  it('keeps Academy discovery AI-first and uses the five approved uploaded images', async () => {
    const { readFile, stat } = await import('node:fs/promises');
    const experience = await readFile('src/features/platform-content/components/public/MketyPublicExperience.tsx', 'utf8');
    const defaults = await readFile('src/features/platform-content/public-page-defaults.ts', 'utf8');
    const supportTools = await readFile('src/features/public-assistant/server/tools.ts', 'utf8');

    for (let index = 1; index <= 5; index += 1) {
      const imagePath = `public/academy-hubs/class${index}.jpg`;
      const imageStat = await stat(imagePath);
      expect(imageStat.size).toBeGreaterThan(100_000);
      expect(experience).toContain(`/academy-hubs/class${index}.jpg`);
    }

    expect(defaults).toContain("label: 'Ask Mkety AI about Academy'");
    expect(defaults).toContain("href: '#mkety-ai'");
    expect(supportTools).toContain("academy: '/academy'");
    expect(supportTools).not.toContain('https://academy.mkety.com');
  });
});
