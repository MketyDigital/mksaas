import { readFile } from 'node:fs/promises';

describe('Enterprise AI business console contract', () => {
  it('routes ai.mkety.com through the secure one-time product handoff', async () => {
    const [proxy, start, consume, auth] = await Promise.all([
      readFile('src/proxy.ts', 'utf8'),
      readFile('src/app/api/auth/product-handoff/start/route.ts', 'utf8'),
      readFile('src/app/api/auth/product-handoff/consume/route.ts', 'utf8'),
      readFile('src/shared/lib/auth/service.ts', 'utf8'),
    ]);

    expect(proxy).toContain("MKETY_AI_HOST||'ai.mkety.com'");
    expect(proxy).toContain("url.searchParams.set('product','ai')");
    expect(start).toContain("value === 'mail' || value === 'ai'");
    expect(consume).toContain("process.env.MKETY_AI_HOST || 'ai.mkety.com'");
    expect(consume).toContain('invalid_handoff_host');
    expect(auth).toContain("export type MketyProductHandoff = 'mail' | 'ai'");
  });

  it('keeps the default customer experience outcome-first and developer controls secondary', async () => {
    const page = await readFile(
      'src/app/app/[tenant]/enterprise-ai/page.tsx',
      'utf8',
    );

    expect(page).toContain('What do you want AI to help your business do?');
    expect(page).toContain('Advanced / Developer');
    expect(page.indexOf('What do you want AI to help your business do?'))
      .toBeLessThan(page.indexOf('Advanced / Developer'));
  });

  it('creates solution drafts without publishing or provider execution', async () => {
    const [action, detail] = await Promise.all([
      readFile('src/features/ai-runtime/server/business-solution-actions.ts', 'utf8'),
      readFile('src/app/app/[tenant]/enterprise-ai/solutions/[id]/page.tsx', 'utf8'),
    ]);

    expect(action).toContain("status: 'draft'");
    expect(action).toContain('hasEnterpriseAiAccess');
    expect(action).toContain('eq(projects.tenantId, tenant.id)');
    expect(action).not.toContain('reserveAiCredits');
    expect(action).not.toContain('WorkersAi');
    expect(detail).toContain('cannot silently publish');
  });

  it('keeps solution presentation admin-editable while protected execution remains outside the editor', async () => {
    const [panel, actions] = await Promise.all([
      readFile('src/features/ai-runtime/components/AiCommercialControlPanel.tsx', 'utf8'),
      readFile('src/features/ai-runtime/server/commercial-admin-actions.ts', 'utf8'),
    ]);

    expect(panel).toContain('Business solution cards');
    expect(actions).toContain('updateAiSolutionTemplate');
    expect(actions).toContain("requirePermission(tenantSlug, 'platform:plans')");
    expect(actions).not.toContain('prepaidOnly: false');
  });
});
